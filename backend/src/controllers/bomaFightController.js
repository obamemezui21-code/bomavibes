const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { BOMA_FIGHT } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// BOMA FIGHT — the fighting game's server side, on the same model as MOTO
// BOMA (motoBomaController.js): the browser sends the gestures it recorded,
// the fight is replayed here through the shared engine
// (shared/boma-fight/engine.mjs) with the seed handed out at /start — the
// computer opponent included, since it is driven by that seed — and only
// that replay is paid and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   fights/{fightId}                                   one fight: uid, seed, fighter, level, startedAt, status, result
//   bomaFightStats/{uid}                               wins, losses, per-level wins, favourite fighter
//   bomaFightLeaderboard/{week}/entries/{uid}          weekly points (a win is worth its level's reward), first name + photo only
//   usage/{uid}.fight*                                 today's starts and Ngori earned in the game

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/boma-fight/engine.mjs");
    return enginePromise;
}

class FightError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof FightError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.fightDay === today ? usage.fightStarts || 0 : 0,
        earned: usage?.fightEarnDay === today ? usage.fightEarned || 0 : 0,
    };
}

// Why a replayed fight can't be paid, or null when it looks genuine.
function anomalyOf({ fight, result, claimed, now }) {
    const elapsed = now - fight.startedAt;
    if (elapsed > BOMA_FIGHT.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * BOMA_FIGHT.minTimeRatio - 1500) return "too_fast";
    const claimedWinner = claimed?.winner === 0 ? "me" : claimed?.winner === 1 ? "cpu" : claimed?.winner === -1 ? "draw" : null;
    if (claimed && result.finished && claimedWinner !== result.winner) return "mismatch";
    return null;
}

const leaderboardEntries = (week) => db.collection("bomaFightLeaderboard").doc(week).collection("entries");

// POST /api/boma-fight/start { fighter, level } → { fightId, seed, fighter, level, opponent, earnedToday, dailyCap }
async function startFight(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const fightRef = db.collection("fights").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const engine = await loadEngine();
        const fighter = engine.FIGHTERS[req.body?.fighter] ? req.body.fighter : engine.FIGHTER_IDS[0];
        const level = engine.LEVELS[req.body?.level] ? req.body.level : engine.DEFAULT_LEVEL;
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= BOMA_FIGHT.maxStartsPerDay) {
                throw new FightError(429, "Beaucoup de combats aujourd'hui ! Reviens demain pour reprendre l'entraînement.");
            }
            if (now - (usage.fightLastStartAt || 0) < BOMA_FIGHT.minStartIntervalMs) {
                throw new FightError(429, "Une seconde… le combat précédent vient juste de commencer.");
            }
            tx.set(usageRef, { fightDay: today, fightStarts: starts + 1, fightLastStartAt: now }, { merge: true });
            tx.set(fightRef, { uid, seed, fighter, level, startedAt: now, status: "running" });
            return earned;
        });
        res.json({
            fightId: fightRef.id,
            seed,
            fighter,
            level,
            opponent: engine.opponentFor(seed, fighter),
            earnedToday: earned,
            dailyCap: BOMA_FIGHT.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de lancer le combat");
    }
}

// POST /api/boma-fight/finish { fightId, inputs: [[tick, action]…], endTick, claimed: { winner, wins } }
// Replays the fight, then pays min(the win's reward, what's left of today's
// cap). A fight can only be finished once.
async function finishFight(req, res) {
    const uid = req.firebaseUser.uid;
    const { fightId, inputs, endTick, claimed } = req.body || {};
    if (typeof fightId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(fightId)) {
        return res.status(400).json({ message: "Combat inconnu" });
    }

    const now = Date.now();
    const today = periodKey("day", now);
    const week = periodKey("week", now);
    const fightRef = db.collection("fights").doc(fightId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const statsRef = db.collection("bomaFightStats").doc(uid);
    const boardRef = leaderboardEntries(week).doc(uid);

    try {
        const engine = await loadEngine();
        const fight = (await fightRef.get()).data();
        if (!fight || fight.uid !== uid) throw new FightError(404, "Combat inconnu");
        if (fight.status !== "running") throw new FightError(409, "Ce combat a déjà été enregistré.");
        if (!engine.validateInputs(inputs, endTick)) {
            await fightRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new FightError(400, "Combat invalide");
        }

        const result = engine.simulateFight(fight.seed, fight.fighter, fight.level, inputs, endTick);
        const anomaly = anomalyOf({ fight, result, claimed, now });
        // A mismatch alone (old app version, odd device) still pays the
        // server's own replay; forged timing or an expired fight pays nothing.
        const payable = anomaly === null || anomaly === "mismatch";
        const won = payable && result.winner === "me";
        const profile = (await db.collection("profiles").doc(uid).get()).data() || {};

        const outcome = await db.runTransaction(async (tx) => {
            const [freshFight, userSnap, usageSnap, statsSnap, boardSnap] = await Promise.all([
                tx.get(fightRef),
                tx.get(userRef),
                tx.get(usageRef),
                tx.get(statsRef),
                tx.get(boardRef),
            ]);
            if (freshFight.data()?.status !== "running") throw new FightError(409, "Ce combat a déjà été enregistré.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const credited = won ? Math.max(0, Math.min(result.reward, BOMA_FIGHT.dailyCap - earned)) : 0;
            const balance = (userSnap.data()?.ngori || 0) + credited;
            const stats = statsSnap.data() || {};
            const lost = payable && result.winner === "cpu";

            tx.update(fightRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { fightEarnDay: today, fightEarned: earned + credited }, { merge: true });
            tx.set(
                statsRef,
                {
                    fights: (stats.fights || 0) + 1,
                    wins: (stats.wins || 0) + (won ? 1 : 0),
                    losses: (stats.losses || 0) + (lost ? 1 : 0),
                    winsByLevel: { ...(stats.winsByLevel || {}), ...(won ? { [fight.level]: (stats.winsByLevel?.[fight.level] || 0) + 1 } : {}) },
                    perfects: (stats.perfects || 0) + (won ? result.perfects : 0),
                    fighters: { ...(stats.fighters || {}), [fight.fighter]: (stats.fighters?.[fight.fighter] || 0) + 1 },
                    totalEarned: (stats.totalEarned || 0) + credited,
                    lastPlayedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            // The weekly ranking only counts clean wins: each is worth its level's reward.
            if (anomaly === null && won) {
                const board = boardSnap.data();
                tx.set(boardRef, {
                    firstName: profile.firstName || "Combattant",
                    photo: profile.photos?.[0] || null,
                    points: (board?.points || 0) + engine.LEVELS[fight.level].reward,
                    wins: (board?.wins || 0) + 1,
                    fighter: fight.fighter,
                    updatedAt: now,
                });
            }
            return { credited, balance, earnedToday: earned + credited };
        });

        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: BOMA_FIGHT.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer le combat");
    }
}

function publicEntry(doc, rank, uid) {
    const e = doc.data();
    return { rank, isMe: doc.id === uid, firstName: e.firstName, photo: e.photo, points: e.points, wins: e.wins, fighter: e.fighter || null };
}

// GET /api/boma-fight/leaderboard → this week's 20 best + the caller's rank.
async function getLeaderboard(req, res) {
    const uid = req.firebaseUser.uid;
    const week = periodKey("week");
    try {
        const entries = leaderboardEntries(week);
        const [topSnap, mineSnap] = await Promise.all([entries.orderBy("points", "desc").limit(20).get(), entries.doc(uid).get()]);
        const top = topSnap.docs.map((doc, i) => publicEntry(doc, i + 1, uid));
        let me = top.find((e) => e.isMe) || null;
        if (!me && mineSnap.exists) {
            const ahead = await entries.where("points", ">", mineSnap.data().points).count().get();
            me = publicEntry(mineSnap, ahead.data().count + 1, uid);
        }
        res.json({ week, top, me });
    } catch (err) {
        sendError(res, err, "Impossible de charger le classement");
    }
}

// GET /api/boma-fight/me → personal stats + today's progress toward the cap.
async function getMyStats(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [statsSnap, usageSnap] = await Promise.all([db.collection("bomaFightStats").doc(uid).get(), db.collection("usage").doc(uid).get()]);
        const s = statsSnap.data() || {};
        res.json({
            stats: {
                fights: s.fights || 0,
                wins: s.wins || 0,
                losses: s.losses || 0,
                winsByLevel: s.winsByLevel || {},
                perfects: s.perfects || 0,
                totalEarned: s.totalEarned || 0,
            },
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: BOMA_FIGHT.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger vos statistiques");
    }
}

module.exports = { startFight, finishFight, getLeaderboard, getMyStats, anomalyOf, loadEngine };
