const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { NGORI_RUN } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// NGORI RUN — the mini-game's server side. The browser never reports a
// score we trust: it sends the gestures it recorded, and the run is replayed
// here through the very engine the game uses (shared/ngori-run/engine.mjs),
// seeded with the seed this server handed out at /start.
//
// Firestore (Admin SDK only — no client rule opens these):
//   ngoriRuns/{runId}                          one run: uid, seed, startedAt, status, result
//   ngoriRunStats/{uid}                        personal bests and totals
//   ngoriRunLeaderboard/{week}/entries/{uid}   weekly best score, first name + photo only
//   usage/{uid}.run*                           today's starts and Ngori earned in the game

// The engine is an ES module shared with the app: loaded once, lazily.
let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/ngori-run/engine.mjs");
    return enginePromise;
}

class RunError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof RunError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.runDay === today ? usage.runStarts || 0 : 0,
        earned: usage?.runEarnDay === today ? usage.runEarned || 0 : 0,
    };
}

// Why a replayed run can't be paid, or null when it looks genuine.
function anomalyOf({ run, result, claimed, now }) {
    const elapsed = now - run.startedAt;
    if (elapsed > NGORI_RUN.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * NGORI_RUN.minTimeRatio - 1500) return "too_fast";
    if (claimed && (claimed.score !== result.score || claimed.distance !== result.distance)) return "mismatch";
    return null;
}

// POST /api/ngori-run/start → { runId, seed, earnedToday, dailyCap }
async function startRun(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const runRef = db.collection("ngoriRuns").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= NGORI_RUN.maxStartsPerDay) {
                throw new RunError(429, "Vous avez beaucoup couru aujourd'hui ! Revenez demain pour de nouvelles courses.");
            }
            if (now - (usage.runLastStartAt || 0) < NGORI_RUN.minStartIntervalMs) {
                throw new RunError(429, "Une seconde… la course précédente vient juste de commencer.");
            }
            tx.set(usageRef, { runDay: today, runStarts: starts + 1, runLastStartAt: now }, { merge: true });
            tx.set(runRef, { uid, seed, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ runId: runRef.id, seed, earnedToday: earned, dailyCap: NGORI_RUN.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la course");
    }
}

// POST /api/ngori-run/finish { runId, inputs: [[tick, action]…], endTick, claimed: { score, distance } }
// Replays the run, then pays min(Ngori earned in the run, what's left of
// today's cap). A run can only be finished once.
async function finishRun(req, res) {
    const uid = req.firebaseUser.uid;
    const { runId, inputs, endTick, claimed } = req.body || {};
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(runId)) {
        return res.status(400).json({ message: "Course inconnue" });
    }

    const now = Date.now();
    const today = periodKey("day", now);
    const week = periodKey("week", now);
    const runRef = db.collection("ngoriRuns").doc(runId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const statsRef = db.collection("ngoriRunStats").doc(uid);
    const boardRef = db.collection("ngoriRunLeaderboard").doc(week).collection("entries").doc(uid);

    try {
        const engine = await loadEngine();
        const runSnap = await runRef.get();
        const run = runSnap.data();
        if (!run || run.uid !== uid) throw new RunError(404, "Course inconnue");
        if (run.status !== "running") throw new RunError(409, "Cette course a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await runRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new RunError(400, "Course invalide");
        }

        const result = engine.simulateRun(run.seed, inputs, endTick);
        const anomaly = anomalyOf({ run, result, claimed, now });
        // A mismatch alone (old app version, odd device) still pays the
        // server's own replay; forged timing or an expired run pays nothing.
        const payable = anomaly === null || anomaly === "mismatch";
        const profile = (await db.collection("profiles").doc(uid).get()).data() || {};

        const outcome = await db.runTransaction(async (tx) => {
            const [freshRun, userSnap, usageSnap, statsSnap, boardSnap] = await Promise.all([
                tx.get(runRef),
                tx.get(userRef),
                tx.get(usageRef),
                tx.get(statsRef),
                tx.get(boardRef),
            ]);
            if (freshRun.data()?.status !== "running") throw new RunError(409, "Cette course a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const credited = payable ? Math.max(0, Math.min(result.total, NGORI_RUN.dailyCap - earned)) : 0;
            const balance = (userSnap.data()?.ngori || 0) + credited;
            const stats = statsSnap.data() || {};
            const board = boardSnap.data();

            tx.update(runRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { runEarnDay: today, runEarned: earned + credited }, { merge: true });
            tx.set(
                statsRef,
                {
                    games: (stats.games || 0) + 1,
                    bestDistance: Math.max(stats.bestDistance || 0, payable ? result.distance : 0),
                    bestScore: Math.max(stats.bestScore || 0, payable ? result.score : 0),
                    bestCombo: Math.max(stats.bestCombo || 0, payable ? result.bestCombo : 0),
                    totalCollected: (stats.totalCollected || 0) + (payable ? result.total : 0),
                    totalEarned: (stats.totalEarned || 0) + credited,
                    lastPlayedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            // The leaderboard only takes runs with nothing odd about them.
            if (anomaly === null) {
                const newBest = !board || result.score > (board.bestScore || 0);
                tx.set(
                    boardRef,
                    {
                        firstName: profile.firstName || "Coureur",
                        photo: profile.photos?.[0] || null,
                        ngoriEarned: (board?.ngoriEarned || 0) + credited,
                        ...(newBest ? { bestScore: result.score, distance: result.distance, updatedAt: now } : {}),
                    },
                    { merge: true },
                );
            }
            return {
                credited,
                balance,
                earnedToday: earned + credited,
                newBestScore: payable && result.score > (stats.bestScore || 0),
                newBestDistance: payable && result.distance > (stats.bestDistance || 0),
            };
        });

        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: NGORI_RUN.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la course");
    }
}

function publicEntry(doc, rank, uid) {
    const e = doc.data();
    return {
        rank,
        isMe: doc.id === uid,
        firstName: e.firstName,
        photo: e.photo,
        score: e.bestScore || 0,
        distance: e.distance || 0,
        ngoriEarned: e.ngoriEarned || 0,
    };
}

// GET /api/ngori-run/leaderboard → this week's top 20 + the caller's rank.
async function getLeaderboard(req, res) {
    const uid = req.firebaseUser.uid;
    const week = periodKey("week");
    const entries = db.collection("ngoriRunLeaderboard").doc(week).collection("entries");
    try {
        const [topSnap, mineSnap] = await Promise.all([entries.orderBy("bestScore", "desc").limit(20).get(), entries.doc(uid).get()]);
        const top = topSnap.docs.map((doc, i) => publicEntry(doc, i + 1, uid));
        let me = top.find((e) => e.isMe) || null;
        if (!me && mineSnap.exists) {
            const ahead = await entries.where("bestScore", ">", mineSnap.data().bestScore || 0).count().get();
            me = publicEntry(mineSnap, ahead.data().count + 1, uid);
        }
        res.json({ week, top, me });
    } catch (err) {
        sendError(res, err, "Impossible de charger le classement");
    }
}

// GET /api/ngori-run/me → personal stats + today's progress toward the cap.
async function getMyRunStats(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [statsSnap, usageSnap] = await Promise.all([
            db.collection("ngoriRunStats").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
        ]);
        const s = statsSnap.data() || {};
        res.json({
            stats: {
                games: s.games || 0,
                bestDistance: s.bestDistance || 0,
                bestScore: s.bestScore || 0,
                bestCombo: s.bestCombo || 0,
                totalCollected: s.totalCollected || 0,
                totalEarned: s.totalEarned || 0,
            },
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: NGORI_RUN.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger vos statistiques");
    }
}

module.exports = { startRun, finishRun, getLeaderboard, getMyRunStats, anomalyOf, loadEngine };
