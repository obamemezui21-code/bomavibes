const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { COMMANDO } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// COMMANDO OKOUMÉ — the run-and-gun's server side, on the same model as
// MOTO BOMA (motoBomaController.js): the browser sends the gestures it
// recorded, the mission is replayed here through the shared engine
// (shared/commando-okoume/engine.mjs) with the seed and options handed out
// at /start, and only that replay is paid, counted for XP and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   commandoRuns/{runId}      one mission: uid, seed, mission, options, startedAt, status, result
//   commandoProgress/{uid}    xp, missions { id: { stars, best } }, totalScore, firstName, photo
//   usage/{uid}.commando*     today's starts and Ngori earned in the game

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/commando-okoume/engine.mjs");
    return enginePromise;
}

class CommandoError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof CommandoError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.commandoDay === today ? usage.commandoStarts || 0 : 0,
        earned: usage?.commandoEarnDay === today ? usage.commandoEarned || 0 : 0,
    };
}

// Mission 1 is open; each next one opens once the previous one is won.
function unlockedMissions(engine, progress) {
    const open = [];
    for (const id of engine.MISSION_IDS) {
        if (id === engine.MISSION_IDS[0] || (progress?.missions?.[id - 1]?.stars || 0) > 0) open.push(id);
        else break;
    }
    return open;
}

function progressView(engine, progress) {
    const xp = progress?.xp || 0;
    return {
        xp,
        grade: engine.gradeFor(xp),
        missions: progress?.missions || {},
        unlocked: unlockedMissions(engine, progress),
        totalScore: progress?.totalScore || 0,
    };
}

// Why a replayed mission can't be paid, or null when it looks genuine.
function anomalyOf({ run, result, claimed, now }) {
    const elapsed = now - run.startedAt;
    if (elapsed > COMMANDO.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * COMMANDO.minTimeRatio - 1500) return "too_fast";
    if (claimed && (claimed.score !== result.score || claimed.completed !== result.completed)) return "mismatch";
    return null;
}

// GET /api/commando → { progress, leaderboard, earnedToday, dailyCap }
async function getCommando(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const engine = await loadEngine();
        const [progressSnap, usageSnap, boardSnap] = await Promise.all([
            db.collection("commandoProgress").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
            db.collection("commandoProgress").orderBy("totalScore", "desc").limit(10).get(),
        ]);
        const leaderboard = boardSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => p.totalScore > 0)
            .map((p) => ({
                me: p.uid === uid,
                firstName: p.firstName || "Commando",
                photo: p.photo || null,
                totalScore: p.totalScore,
                grade: engine.gradeFor(p.xp || 0).name,
            }));
        res.json({
            progress: progressView(engine, progressSnap.data()),
            leaderboard,
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: COMMANDO.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger Commando Okoumé");
    }
}

// POST /api/commando/start { mission, character } → { runId, seed, mission, options, earnedToday, dailyCap }
async function startMission(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const runRef = db.collection("commandoRuns").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const engine = await loadEngine();
        const mission = Number(req.body?.mission);
        if (!engine.MISSIONS[mission]) throw new CommandoError(400, "Mission inconnue");
        const progress = (await db.collection("commandoProgress").doc(uid).get()).data();
        if (!unlockedMissions(engine, progress).includes(mission)) {
            throw new CommandoError(403, "Réussissez d'abord la mission précédente.");
        }
        const grade = engine.gradeFor(progress?.xp || 0);
        const character = grade.characters.includes(req.body?.character) ? req.body.character : grade.characters[0];
        // The grade sets the hearts; both sides replay with these options.
        const options = { character, maxHp: grade.maxHp };

        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= COMMANDO.maxStartsPerDay) {
                throw new CommandoError(429, "Beaucoup de missions aujourd'hui ! L'unité se repose, revenez demain.");
            }
            if (now - (usage.commandoLastStartAt || 0) < COMMANDO.minStartIntervalMs) {
                throw new CommandoError(429, "Une seconde… la mission précédente vient juste de partir.");
            }
            tx.set(usageRef, { commandoDay: today, commandoStarts: starts + 1, commandoLastStartAt: now }, { merge: true });
            tx.set(runRef, { uid, seed, mission, options, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ runId: runRef.id, seed, mission, options, earnedToday: earned, dailyCap: COMMANDO.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la mission");
    }
}

// POST /api/commando/finish { runId, inputs, endTick, claimed }
//   → { result, credited, balance, earnedToday, xpGained, grade, promoted, newBest, unlocked, anomaly }
async function finishMission(req, res) {
    const uid = req.firebaseUser.uid;
    const { runId, inputs, endTick, claimed } = req.body || {};
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(runId)) {
        return res.status(400).json({ message: "Mission inconnue" });
    }
    const now = Date.now();
    const today = periodKey("day", now);
    const runRef = db.collection("commandoRuns").doc(runId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const progressRef = db.collection("commandoProgress").doc(uid);

    try {
        const engine = await loadEngine();
        const run = (await runRef.get()).data();
        if (!run || run.uid !== uid) throw new CommandoError(404, "Mission inconnue");
        if (run.status !== "running") throw new CommandoError(409, "Cette mission a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await runRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new CommandoError(400, "Mission invalide");
        }

        const result = engine.simulateGame(run.seed, run.mission, run.options, inputs, endTick);
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
            if (freshRun.data()?.status !== "running") throw new CommandoError(409, "Cette mission a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const reward = payable && result.completed ? result.stars : 0;
            const credited = Math.max(0, Math.min(reward, COMMANDO.dailyCap - earned));
            const balance = (userSnap.data()?.ngori || 0) + credited;

            const progress = progressSnap.data() || {};
            const before = engine.gradeFor(progress.xp || 0);
            const xpGained = payable ? engine.xpFor(result) : 0;
            const xp = (progress.xp || 0) + xpGained;
            const after = engine.gradeFor(xp);
            const previous = progress.missions?.[run.mission] || { stars: 0, best: 0 };
            const newBest = payable && result.score > previous.best;
            const missions = {
                ...(progress.missions || {}),
                [run.mission]: {
                    stars: payable ? Math.max(previous.stars, result.stars) : previous.stars,
                    best: newBest ? result.score : previous.best,
                },
            };
            const totalScore = Object.values(missions).reduce((sum, m) => sum + (m.best || 0), 0);
            const unlockedBefore = unlockedMissions(engine, progress);
            const unlockedAfter = unlockedMissions(engine, { missions });

            tx.update(runRef, { status: payable ? "finished" : "rejected", result, credited, xpGained, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { commandoEarnDay: today, commandoEarned: earned + credited }, { merge: true });
            tx.set(progressRef, {
                xp,
                missions,
                totalScore,
                runs: (progress.runs || 0) + 1,
                wins: (progress.wins || 0) + (payable && result.completed ? 1 : 0),
                firstName: profile.firstName || "Commando",
                photo: profile.photos?.[0] || null,
                updatedAt: FieldValue.serverTimestamp(),
            });
            return {
                credited,
                balance,
                earnedToday: earned + credited,
                xpGained,
                grade: after,
                promoted: after.index > before.index ? after.name : null,
                newBest,
                unlocked: unlockedAfter.find((id) => !unlockedBefore.includes(id)) || null,
            };
        });
        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: COMMANDO.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la mission");
    }
}

module.exports = { getCommando, startMission, finishMission };
