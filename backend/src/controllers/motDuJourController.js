const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { MOT_DU_JOUR, previousDay } = require("../config/ngori");
const { WORDS } = require("../config/motDuJourWords");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// LE MOT DU JOUR — a daily word to find in 6 tries, the same for everyone.
// The answer never leaves the server until the game is over: every guess is
// marked here (shared/mot-du-jour/engine.mjs) and only the marks go back.
//
// Firestore (Admin SDK only — no client rule opens these):
//   motDuJourDays/{day}           the day's word, fixed the first time anyone opens it
//   motDuJourGames/{day}_{uid}    one player's game: guesses, marks, status, credited
//   motDuJourStats/{uid}          played, won, streak, bestStreak, lastWonDay, distribution

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/mot-du-jour/engine.mjs");
    return enginePromise;
}

class GameError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof GameError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_DAY = "2026-10-15";

// The list is walked with a fixed stride coprime with its length: every word
// comes once, in a scrambled order, before any repeats.
function wordForDay(day, words = WORDS) {
    const n = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY_MS);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let stride = 7;
    while (gcd(stride, words.length) !== 1) stride++;
    return words[(((n * stride) % words.length) + words.length) % words.length];
}

// Today's word, written to motDuJourDays/{day} on first use so that later
// edits of the list never change a word already in play.
async function dayWord(day) {
    const { normalizeWord } = await loadEngine();
    const ref = db.collection("motDuJourDays").doc(day);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data();
        const entry = wordForDay(day);
        const data = { word: entry.word, answer: normalizeWord(entry.word), hint: entry.hint, fact: entry.fact, createdAt: Date.now() };
        tx.set(ref, data);
        return data;
    });
}

// A streak only counts while its last win is today or yesterday.
function liveStreak(stats, today) {
    return stats.lastWonDay === today || stats.lastWonDay === previousDay(today) ? stats.streak || 0 : 0;
}

function view({ day, word, game, stats, maxTries }) {
    const done = game.status === "won" || game.status === "lost";
    return {
        day,
        length: word.answer.length,
        hint: word.hint,
        maxTries,
        guesses: game.guesses || [],
        marks: game.marks || [],
        status: game.status || "playing",
        credited: game.credited || 0,
        reveal: done ? { word: word.word, fact: word.fact } : null,
        stats: {
            played: stats.played || 0,
            won: stats.won || 0,
            streak: liveStreak(stats, day),
            bestStreak: stats.bestStreak || 0,
            distribution: stats.distribution || Array(maxTries).fill(0),
        },
        rewards: MOT_DU_JOUR,
    };
}

const gameRef = (day, uid) => db.collection("motDuJourGames").doc(`${day}_${uid}`);
const statsRef = (uid) => db.collection("motDuJourStats").doc(uid);

// GET /api/mot-du-jour → today's game as the player sees it.
async function getToday(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    try {
        const { MAX_TRIES } = await loadEngine();
        const [word, gameSnap, statsSnap] = await Promise.all([dayWord(day), gameRef(day, uid).get(), statsRef(uid).get()]);
        res.json(view({ day, word, game: gameSnap.data() || {}, stats: statsSnap.data() || {}, maxTries: MAX_TRIES }));
    } catch (err) {
        sendError(res, err, "Impossible de charger le mot du jour");
    }
}

// POST /api/mot-du-jour/guess { guess, day } → the updated game.
// `day` is the day the player's screen shows: a guess typed before midnight
// UTC and sent after is refused rather than marked against the next word.
async function submitGuess(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    if (req.body?.day && req.body.day !== day) {
        return res.status(409).json({ message: "Un nouveau mot vient d’arriver ! Recharge la page pour le découvrir." });
    }
    try {
        const engine = await loadEngine();
        const word = await dayWord(day);
        const guess = engine.normalizeWord(req.body?.guess);
        if (!engine.isValidGuess(guess, word.answer.length)) {
            throw new GameError(400, `Le mot doit faire ${word.answer.length} lettres.`);
        }
        const userRef = db.collection("users").doc(uid);

        const out = await db.runTransaction(async (tx) => {
            const [gameSnap, statsSnap] = await Promise.all([tx.get(gameRef(day, uid)), tx.get(statsRef(uid))]);
            const game = gameSnap.data() || { uid, day, guesses: [], marks: [], status: "playing", startedAt: Date.now() };
            const stats = statsSnap.data() || {};
            if (game.status !== "playing") throw new GameError(409, "Tu as déjà joué aujourd’hui. Reviens demain pour un nouveau mot !");

            const marks = engine.markGuess(guess, word.answer);
            game.guesses = [...game.guesses, guess];
            game.marks = [...game.marks, marks];
            const tries = game.guesses.length;
            const won = guess === word.answer;
            const lost = !won && tries >= engine.MAX_TRIES;

            let nextStats = stats;
            if (won || lost) {
                game.status = won ? "won" : "lost";
                game.finishedAt = Date.now();
                const distribution = [...(stats.distribution || Array(engine.MAX_TRIES).fill(0))];
                if (won) distribution[tries - 1] = (distribution[tries - 1] || 0) + 1;
                const streak = won ? (stats.lastWonDay === previousDay(day) ? (stats.streak || 0) + 1 : 1) : 0;

                let credited = 0;
                if (won) {
                    credited = tries <= MOT_DU_JOUR.quickWinTries ? MOT_DU_JOUR.quickWinReward : MOT_DU_JOUR.winReward;
                    if (streak % MOT_DU_JOUR.streakLength === 0) credited += MOT_DU_JOUR.streakBonus;
                    tx.update(userRef, { ngori: FieldValue.increment(credited) });
                }
                game.credited = credited;
                nextStats = {
                    played: (stats.played || 0) + 1,
                    won: (stats.won || 0) + (won ? 1 : 0),
                    streak,
                    bestStreak: Math.max(stats.bestStreak || 0, streak),
                    lastWonDay: won ? day : stats.lastWonDay || null,
                    distribution,
                    totalEarned: (stats.totalEarned || 0) + credited,
                    lastPlayedAt: FieldValue.serverTimestamp(),
                };
                tx.set(statsRef(uid), nextStats);
            }
            tx.set(gameRef(day, uid), game);
            return { game, stats: nextStats };
        });

        res.json(view({ day, word, game: out.game, stats: out.stats, maxTries: engine.MAX_TRIES }));
    } catch (err) {
        sendError(res, err, "Impossible d’enregistrer ce mot");
    }
}

module.exports = { getToday, submitGuess, wordForDay };
