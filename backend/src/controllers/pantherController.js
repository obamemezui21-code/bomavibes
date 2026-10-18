const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { PANTHERE } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// ŒIL DE PANTHÈRE — the scoped-rifle game's server side, on the same model as
// COMMANDO OKOUMÉ (commandoController.js): the browser sends the shots it
// recorded, the game is replayed here through the shared engine
// (shared/oeil-de-panthere/engine.mjs) with the seed and rifle handed out at
// /start, and only that replay is paid and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   pantherRuns/{runId}      one game: uid, seed, options, startedAt, status, result
//   pantherProgress/{uid}    best, bestStars, runs, firstName, photo
//   usage/{uid}.panther*     today's starts and Ngori earned in the game

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/oeil-de-panthere/engine.mjs");
    return enginePromise;
}

class PantherError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof PantherError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.pantherDay === today ? usage.pantherStarts || 0 : 0,
        earned: usage?.pantherEarnDay === today ? usage.pantherEarned || 0 : 0,
    };
}

// Why a replayed game can't be paid, or null when it looks genuine.
function anomalyOf({ run, result, claimed, now }) {
    const elapsed = now - run.startedAt;
    if (elapsed > PANTHERE.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * PANTHERE.minTimeRatio - 1500) return "too_fast";
    if (claimed && claimed.score !== result.score) return "mismatch";
    return null;
}

// GET /api/panthere → { best, bestStars, runs, leaderboard, earnedToday, dailyCap }
async function getPanther(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [progressSnap, usageSnap, boardSnap] = await Promise.all([
            db.collection("pantherProgress").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
            db.collection("pantherProgress").orderBy("best", "desc").limit(10).get(),
        ]);
        const progress = progressSnap.data() || {};
        const leaderboard = boardSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => p.best > 0)
            .map((p) => ({ me: p.uid === uid, firstName: p.firstName || "Tireur", photo: p.photo || null, best: p.best }));
        res.json({
            best: progress.best || 0,
            bestStars: progress.bestStars || 0,
            runs: progress.runs || 0,
            leaderboard,
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: PANTHERE.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger Œil de Panthère");
    }
}

// POST /api/panthere/start { rifle } → { runId, seed, options, earnedToday, dailyCap }
async function startGame(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const runRef = db.collection("pantherRuns").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const engine = await loadEngine();
        const options = { rifle: engine.rifleOf({ rifle: req.body?.rifle }) };
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= PANTHERE.maxStartsPerDay) {
                throw new PantherError(429, "Beaucoup de parties aujourd'hui ! Repose ton œil, reviens demain.");
            }
            if (now - (usage.pantherLastStartAt || 0) < PANTHERE.minStartIntervalMs) {
                throw new PantherError(429, "Une seconde… la partie précédente vient juste de partir.");
            }
            tx.set(usageRef, { pantherDay: today, pantherStarts: starts + 1, pantherLastStartAt: now }, { merge: true });
            tx.set(runRef, { uid, seed, options, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ runId: runRef.id, seed, options, earnedToday: earned, dailyCap: PANTHERE.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la partie");
    }
}

// POST /api/panthere/finish { runId, inputs, endTick, claimed }
//   → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
async function finishGame(req, res) {
    const uid = req.firebaseUser.uid;
    const { runId, inputs, endTick, claimed } = req.body || {};
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(runId)) {
        return res.status(400).json({ message: "Partie inconnue" });
    }
    const now = Date.now();
    const today = periodKey("day", now);
    const runRef = db.collection("pantherRuns").doc(runId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const progressRef = db.collection("pantherProgress").doc(uid);

    try {
        const engine = await loadEngine();
        const run = (await runRef.get()).data();
        if (!run || run.uid !== uid) throw new PantherError(404, "Partie inconnue");
        if (run.status !== "running") throw new PantherError(409, "Cette partie a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await runRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new PantherError(400, "Partie invalide");
        }

        const result = engine.simulateGame(run.seed, run.options, inputs, endTick);
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
            if (freshRun.data()?.status !== "running") throw new PantherError(409, "Cette partie a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const reward = payable ? result.stars : 0;
            const credited = Math.max(0, Math.min(reward, PANTHERE.dailyCap - earned));
            const balance = (userSnap.data()?.ngori || 0) + credited;

            const progress = progressSnap.data() || {};
            const newBest = payable && result.score > (progress.best || 0);
            const best = newBest ? result.score : progress.best || 0;

            tx.update(runRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { pantherEarnDay: today, pantherEarned: earned + credited }, { merge: true });
            tx.set(progressRef, {
                best,
                bestStars: Math.max(progress.bestStars || 0, payable ? result.stars : 0),
                runs: (progress.runs || 0) + 1,
                firstName: profile.firstName || "Tireur",
                photo: profile.photos?.[0] || null,
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { credited, balance, earnedToday: earned + credited, newBest, best };
        });
        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: PANTHERE.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la partie");
    }
}

module.exports = { getPanther, startGame, finishGame };
