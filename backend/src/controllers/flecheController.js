const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { FLECHE } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// FLÈCHE D'ÉBÈNE — the bow hunter's server side, on the same model as ŒIL DE
// PANTHÈRE (pantherController.js): the browser sends the arrows it recorded,
// the game is replayed here through the shared engine
// (shared/fleche-ebene/engine.mjs) with the seed handed out at /start, and
// only that replay is paid and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   flecheRuns/{runId}       one game: uid, seed, startedAt, status, result
//   flecheProgress/{uid}     best, bestStars, runs, firstName, photo
//   usage/{uid}.fleche*      today's starts and Ngori earned in the game

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/fleche-ebene/engine.mjs");
    return enginePromise;
}

class FlecheError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof FlecheError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.flecheDay === today ? usage.flecheStarts || 0 : 0,
        earned: usage?.flecheEarnDay === today ? usage.flecheEarned || 0 : 0,
    };
}

// Why a replayed game can't be paid, or null when it looks genuine.
function anomalyOf({ run, result, claimed, now }) {
    const elapsed = now - run.startedAt;
    if (elapsed > FLECHE.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * FLECHE.minTimeRatio - 1500) return "too_fast";
    if (claimed && claimed.score !== result.score) return "mismatch";
    return null;
}

// GET /api/fleche → { best, bestStars, runs, leaderboard, earnedToday, dailyCap }
async function getFleche(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [progressSnap, usageSnap, boardSnap] = await Promise.all([
            db.collection("flecheProgress").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
            db.collection("flecheProgress").orderBy("best", "desc").limit(10).get(),
        ]);
        const progress = progressSnap.data() || {};
        const leaderboard = boardSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => p.best > 0)
            .map((p) => ({ me: p.uid === uid, firstName: p.firstName || "Archer", photo: p.photo || null, best: p.best }));
        res.json({
            best: progress.best || 0,
            bestStars: progress.bestStars || 0,
            runs: progress.runs || 0,
            leaderboard,
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: FLECHE.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger Flèche d'Ébène");
    }
}

// POST /api/fleche/start → { runId, seed, earnedToday, dailyCap }
async function startGame(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const runRef = db.collection("flecheRuns").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= FLECHE.maxStartsPerDay) {
                throw new FlecheError(429, "Beaucoup de parties aujourd'hui ! Repose ton bras, reviens demain.");
            }
            if (now - (usage.flecheLastStartAt || 0) < FLECHE.minStartIntervalMs) {
                throw new FlecheError(429, "Une seconde… la partie précédente vient juste de partir.");
            }
            tx.set(usageRef, { flecheDay: today, flecheStarts: starts + 1, flecheLastStartAt: now }, { merge: true });
            tx.set(runRef, { uid, seed, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ runId: runRef.id, seed, earnedToday: earned, dailyCap: FLECHE.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la partie");
    }
}

// POST /api/fleche/finish { runId, inputs, endTick, claimed }
//   → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
async function finishGame(req, res) {
    const uid = req.firebaseUser.uid;
    const { runId, inputs, endTick, claimed } = req.body || {};
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(runId)) {
        return res.status(400).json({ message: "Partie inconnue" });
    }
    const now = Date.now();
    const today = periodKey("day", now);
    const runRef = db.collection("flecheRuns").doc(runId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const progressRef = db.collection("flecheProgress").doc(uid);

    try {
        const engine = await loadEngine();
        const run = (await runRef.get()).data();
        if (!run || run.uid !== uid) throw new FlecheError(404, "Partie inconnue");
        if (run.status !== "running") throw new FlecheError(409, "Cette partie a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await runRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new FlecheError(400, "Partie invalide");
        }

        const result = engine.simulateGame(run.seed, inputs, endTick);
        const anomaly = anomalyOf({ run, result, claimed, now });
        // A mismatch only means the browser drew something else: the replay is the truth.
        const payable = anomaly === null || anomaly === "mismatch";
        const profile = (await db.collection("profiles").doc(uid).get()).data() || {};

        const outcome = await db.runTransaction(async (tx) => {
            const [freshRun, userSnap, usageSnap, progressSnap] = await Promise.all([
                tx.get(runRef),
                tx.get(userRef),
                tx.get(usageRef),
                tx.get(progressRef),
            ]);
            if (freshRun.data()?.status !== "running") throw new FlecheError(409, "Cette partie a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const reward = payable ? result.stars : 0;
            const credited = Math.max(0, Math.min(reward, FLECHE.dailyCap - earned));
            const balance = (userSnap.data()?.ngori || 0) + credited;

            const progress = progressSnap.data() || {};
            const newBest = payable && result.score > (progress.best || 0);
            const best = newBest ? result.score : progress.best || 0;

            tx.update(runRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { flecheEarnDay: today, flecheEarned: earned + credited }, { merge: true });
            tx.set(progressRef, {
                best,
                bestStars: Math.max(progress.bestStars || 0, payable ? result.stars : 0),
                runs: (progress.runs || 0) + 1,
                firstName: profile.firstName || "Archer",
                photo: profile.photos?.[0] || null,
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { credited, balance, earnedToday: earned + credited, newBest, best };
        });
        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: FLECHE.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la partie");
    }
}

module.exports = { getFleche, startGame, finishGame };
