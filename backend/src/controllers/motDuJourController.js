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
//   motDuJourGames/{day}_{uid}    one player's game: guesses, marks, status, hintsUsed, credited
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
        const data = { word: entry.word, answer: normalizeWord(entry.word), hint: entry.hint, clues: entry.clues || null, fact: entry.fact, createdAt: Date.now() };
        tx.set(ref, data);
        return data;
    });
}

// The two written clues of a day's word. Days fixed before clues existed
// find theirs in the list; a word without any gets two clues made from its
// letters, so every word has its four hints.
function cluesFor(word) {
    if (word.clues?.length >= 2) return word.clues;
    const entry = WORDS.find((w) => w.word === word.word);
    if (entry?.clues?.length >= 2) return entry.clues;
    const vowels = [...word.answer].filter((l) => "AEIOUY".includes(l)).length;
    return [
        `Le mot contient ${vowels} voyelle${vowels > 1 ? "s" : ""}.`,
        `Le mot se termine par « ${word.answer[word.answer.length - 1]} ».`,
    ];
}

// The hints the player has asked for so far: never one more. Levels 3 and 4
// show letters in place: pattern "G____", "G_B_N" ("_" = still to find).
function hintsFor(word, used, engine) {
    const clues = cluesFor(word);
    const n = word.answer.length;
    return Array.from({ length: Math.min(used, engine.MAX_HINTS) }, (_, i) => {
        const level = i + 1;
        const hint = { level, label: engine.HINT_LABELS[i] };
        if (level <= 2) return { ...hint, text: clues[i] };
        const pattern = engine.letterPattern(word.answer, level);
        const shown = [...pattern].filter((l) => l !== "_").length;
        return {
            ...hint,
            pattern,
            text: level === 3 ? `Le mot commence par « ${word.answer[0]} ».` : `${shown} lettres sur ${n} dévoilées, à leur place.`,
        };
    });
}

// A streak only counts while its last win is today or yesterday.
function liveStreak(stats, today) {
    return stats.lastWonDay === today || stats.lastWonDay === previousDay(today) ? stats.streak || 0 : 0;
}

function view({ day, word, game, stats, engine }) {
    const done = game.status === "won" || game.status === "lost";
    const maxTries = engine.MAX_TRIES;
    const hintsUsed = game.hintsUsed || 0;
    return {
        day,
        length: word.answer.length,
        hint: word.hint,
        hints: hintsFor(word, hintsUsed, engine),
        hintsUsed,
        maxHints: engine.MAX_HINTS,
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
        const engine = await loadEngine();
        const [word, gameSnap, statsSnap] = await Promise.all([dayWord(day), gameRef(day, uid).get(), statsRef(uid).get()]);
        res.json(view({ day, word, game: gameSnap.data() || {}, stats: statsSnap.data() || {}, engine }));
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
                    credited = engine.rewardFor({ tries, hintsUsed: game.hintsUsed || 0, streak }, MOT_DU_JOUR);
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

        res.json(view({ day, word, game: out.game, stats: out.stats, engine }));
    } catch (err) {
        sendError(res, err, "Impossible d’enregistrer ce mot");
    }
}

// POST /api/mot-du-jour/hint { day } → the game with one more hint shown.
// Only while playing, one at a time, at most MAX_HINTS; hints past the free
// ones lower the win's reward (engine.rewardFor), never the balance.
async function takeHint(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    if (req.body?.day && req.body.day !== day) {
        return res.status(409).json({ message: "Un nouveau mot vient d’arriver ! Recharge la page pour le découvrir." });
    }
    try {
        const engine = await loadEngine();
        const word = await dayWord(day);
        const out = await db.runTransaction(async (tx) => {
            const [gameSnap, statsSnap] = await Promise.all([tx.get(gameRef(day, uid)), tx.get(statsRef(uid))]);
            const game = gameSnap.data() || { uid, day, guesses: [], marks: [], status: "playing", startedAt: Date.now() };
            if (game.status !== "playing") throw new GameError(409, "La partie est terminée : plus besoin d’indice !");
            if ((game.hintsUsed || 0) >= engine.MAX_HINTS) throw new GameError(409, "Tu as déjà tous les indices. À toi de jouer !");
            game.hintsUsed = (game.hintsUsed || 0) + 1;
            tx.set(gameRef(day, uid), game);
            return { game, stats: statsSnap.data() || {} };
        });
        res.json(view({ day, word, game: out.game, stats: out.stats, engine }));
    } catch (err) {
        sendError(res, err, "Impossible d’afficher l’indice");
    }
}

module.exports = { getToday, submitGuess, takeHint, wordForDay, cluesFor };
