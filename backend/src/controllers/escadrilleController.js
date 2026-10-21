const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { ESCADRILLE } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// ESCADRILLE OGOUÉ — the fighter-jet game's server side, on the same model as
// ŒIL DE PANTHÈRE (pantherController.js): the browser sends the gestures it
// recorded, the sortie is replayed here through the shared engine
// (shared/escadrille-ogooue/engine.mjs) with the seed and jet handed out at
// /start, and only that replay is paid and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   escadrilleRuns/{runId}      one sortie: uid, seed, options, startedAt, status, result
//   escadrilleProgress/{uid}    best, bestStars, runs, wins, firstName, photo
//   usage/{uid}.escadrille*     today's starts and Ngori earned in the game

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/escadrille-ogooue/engine.mjs");
    return enginePromise;
}

class EscadrilleError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof EscadrilleError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.escadrilleDay === today ? usage.escadrilleStarts || 0 : 0,
        earned: usage?.escadrilleEarnDay === today ? usage.escadrilleEarned || 0 : 0,
    };
}

// Why a replayed sortie can't be paid, or null when it looks genuine.
function anomalyOf({ run, result, claimed, now }) {
    const elapsed = now - run.startedAt;
    if (elapsed > ESCADRILLE.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * ESCADRILLE.minTimeRatio - 1500) return "too_fast";
    if (claimed && claimed.score !== result.score) return "mismatch";
    return null;
}

// GET /api/escadrille → { best, bestStars, runs, wins, leaderboard, earnedToday, dailyCap }
async function getEscadrille(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [progressSnap, usageSnap, boardSnap] = await Promise.all([
            db.collection("escadrilleProgress").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
            db.collection("escadrilleProgress").orderBy("best", "desc").limit(10).get(),
        ]);
        const progress = progressSnap.data() || {};
        const leaderboard = boardSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => p.best > 0)
            .map((p) => ({ me: p.uid === uid, firstName: p.firstName || "Pilote", photo: p.photo || null, best: p.best }));
        res.json({
            best: progress.best || 0,
            bestStars: progress.bestStars || 0,
            runs: progress.runs || 0,
            wins: progress.wins || 0,
            leaderboard,
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: ESCADRILLE.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger Escadrille Ogooué");
    }
}

// POST /api/escadrille/start { jet } → { runId, seed, options, earnedToday, dailyCap }
async function startGame(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const runRef = db.collection("escadrilleRuns").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const engine = await loadEngine();
        const options = { jet: engine.jetOf({ jet: req.body?.jet }) };
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= ESCADRILLE.maxStartsPerDay) {
                throw new EscadrilleError(429, "Beaucoup de missions aujourd'hui ! L'escadrille se repose, reviens demain.");
            }
            if (now - (usage.escadrilleLastStartAt || 0) < ESCADRILLE.minStartIntervalMs) {
                throw new EscadrilleError(429, "Une seconde… la mission précédente vient juste de partir.");
            }
            tx.set(usageRef, { escadrilleDay: today, escadrilleStarts: starts + 1, escadrilleLastStartAt: now }, { merge: true });
            tx.set(runRef, { uid, seed, options, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ runId: runRef.id, seed, options, earnedToday: earned, dailyCap: ESCADRILLE.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la mission");
    }
}

// POST /api/escadrille/finish { runId, inputs, endTick, claimed }
//   → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
async function finishGame(req, res) {
    const uid = req.firebaseUser.uid;
    const { runId, inputs, endTick, claimed } = req.body || {};
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(runId)) {
        return res.status(400).json({ message: "Mission inconnue" });
    }
    const now = Date.now();
    const today = periodKey("day", now);
    const runRef = db.collection("escadrilleRuns").doc(runId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const progressRef = db.collection("escadrilleProgress").doc(uid);

    try {
        const engine = await loadEngine();
        const run = (await runRef.get()).data();
        if (!run || run.uid !== uid) throw new EscadrilleError(404, "Mission inconnue");
        if (run.status !== "running") throw new EscadrilleError(409, "Cette mission a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await runRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new EscadrilleError(400, "Mission invalide");
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
            if (freshRun.data()?.status !== "running") throw new EscadrilleError(409, "Cette mission a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const reward = payable ? result.stars : 0;
            const credited = Math.max(0, Math.min(reward, ESCADRILLE.dailyCap - earned));
            const balance = (userSnap.data()?.ngori || 0) + credited;

            const progress = progressSnap.data() || {};
            const newBest = payable && result.score > (progress.best || 0);
            const best = newBest ? result.score : progress.best || 0;

            tx.update(runRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { escadrilleEarnDay: today, escadrilleEarned: earned + credited }, { merge: true });
            tx.set(progressRef, {
                best,
                bestStars: Math.max(progress.bestStars || 0, payable ? result.stars : 0),
                runs: (progress.runs || 0) + 1,
                wins: (progress.wins || 0) + (payable && result.won ? 1 : 0),
                firstName: profile.firstName || "Pilote",
                photo: profile.photos?.[0] || null,
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { credited, balance, earnedToday: earned + credited, newBest, best };
        });
        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: ESCADRILLE.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la mission");
    }
}

module.exports = { getEscadrille, startGame, finishGame };
