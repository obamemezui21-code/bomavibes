const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { MOTO_BOMA } = require("../config/ngori");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// MOTO BOMA — the motorbike race's server side, on the same model as NGORI
// RUN (ngoriRunController.js): the browser sends the gestures it recorded,
// the race is replayed here through the shared engine
// (shared/moto-boma/engine.mjs) with the seed handed out at /start, and only
// that replay is paid and ranked.
//
// Firestore (Admin SDK only — no client rule opens these):
//   motoRaces/{raceId}                                   one race: uid, seed, course, startedAt, status, result
//   motoBomaStats/{uid}                                  personal bests and totals
//   motoBomaLeaderboard/{week}_{course}/entries/{uid}    weekly best time, first name + photo only
//   usage/{uid}.moto*                                    today's starts and Ngori earned in the race

let enginePromise = null;
function loadEngine() {
    enginePromise ||= import("../../../shared/moto-boma/engine.mjs");
    return enginePromise;
}

class RaceError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof RaceError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

function todayUsage(usage, today) {
    return {
        starts: usage?.motoDay === today ? usage.motoStarts || 0 : 0,
        earned: usage?.motoEarnDay === today ? usage.motoEarned || 0 : 0,
    };
}

// Why a replayed race can't be paid, or null when it looks genuine.
function anomalyOf({ race, result, claimed, now }) {
    const elapsed = now - race.startedAt;
    if (elapsed > MOTO_BOMA.maxRunMs) return "expired";
    const simulatedMs = (result.ticks / 60) * 1000;
    if (elapsed < simulatedMs * MOTO_BOMA.minTimeRatio - 1500) return "too_fast";
    if (claimed && (claimed.finishTick !== result.finishTick || claimed.coins !== result.coins)) return "mismatch";
    return null;
}

const leaderboardDoc = (week, course) => db.collection("motoBomaLeaderboard").doc(`${week}_${course}`);

// POST /api/moto-boma/start { course } → { raceId, seed, course, earnedToday, dailyCap }
async function startRace(req, res) {
    const uid = req.firebaseUser.uid;
    const usageRef = db.collection("usage").doc(uid);
    const raceRef = db.collection("motoRaces").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    const seed = crypto.randomInt(0, 2 ** 32);
    try {
        const engine = await loadEngine();
        const course = engine.COURSES[req.body?.course] ? req.body.course : engine.DEFAULT_COURSE;
        const earned = await db.runTransaction(async (tx) => {
            const usage = (await tx.get(usageRef)).data() || {};
            const { starts, earned } = todayUsage(usage, today);
            if (starts >= MOTO_BOMA.maxStartsPerDay) {
                throw new RaceError(429, "Beaucoup de courses aujourd'hui ! Revenez demain pour reprendre la route.");
            }
            if (now - (usage.motoLastStartAt || 0) < MOTO_BOMA.minStartIntervalMs) {
                throw new RaceError(429, "Une seconde… la course précédente vient juste de partir.");
            }
            tx.set(usageRef, { motoDay: today, motoStarts: starts + 1, motoLastStartAt: now }, { merge: true });
            tx.set(raceRef, { uid, seed, course, startedAt: now, status: "running" });
            return earned;
        });
        res.json({ raceId: raceRef.id, seed, course, earnedToday: earned, dailyCap: MOTO_BOMA.dailyCap });
    } catch (err) {
        sendError(res, err, "Impossible de lancer la course");
    }
}

// POST /api/moto-boma/finish { raceId, inputs: [[tick, action]…], endTick, claimed: { finishTick, coins } }
// Replays the race, then pays min(Ngori earned, what's left of today's cap).
// A race can only be finished once.
async function finishRace(req, res) {
    const uid = req.firebaseUser.uid;
    const { raceId, inputs, endTick, claimed } = req.body || {};
    if (typeof raceId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(raceId)) {
        return res.status(400).json({ message: "Course inconnue" });
    }

    const now = Date.now();
    const today = periodKey("day", now);
    const week = periodKey("week", now);
    const raceRef = db.collection("motoRaces").doc(raceId);
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const statsRef = db.collection("motoBomaStats").doc(uid);

    try {
        const engine = await loadEngine();
        const race = (await raceRef.get()).data();
        if (!race || race.uid !== uid) throw new RaceError(404, "Course inconnue");
        if (race.status !== "running") throw new RaceError(409, "Cette course a déjà été enregistrée.");
        if (!engine.validateInputs(inputs, endTick)) {
            await raceRef.update({ status: "rejected", anomaly: "bad_inputs", finishedAt: now });
            throw new RaceError(400, "Course invalide");
        }

        const result = engine.simulateRace(race.seed, race.course, inputs, endTick);
        const anomaly = anomalyOf({ race, result, claimed, now });
        // A mismatch alone (old app version, odd device) still pays the
        // server's own replay; forged timing or an expired race pays nothing.
        const payable = anomaly === null || anomaly === "mismatch";
        const profile = (await db.collection("profiles").doc(uid).get()).data() || {};
        const boardRef = leaderboardDoc(week, race.course).collection("entries").doc(uid);

        const outcome = await db.runTransaction(async (tx) => {
            const [freshRace, userSnap, usageSnap, statsSnap, boardSnap] = await Promise.all([
                tx.get(raceRef),
                tx.get(userRef),
                tx.get(usageRef),
                tx.get(statsRef),
                tx.get(boardRef),
            ]);
            if (freshRace.data()?.status !== "running") throw new RaceError(409, "Cette course a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            const credited = payable ? Math.max(0, Math.min(result.total, MOTO_BOMA.dailyCap - earned)) : 0;
            const balance = (userSnap.data()?.ngori || 0) + credited;
            const stats = statsSnap.data() || {};
            const bestTicks = stats.bestTicks?.[race.course] || null;
            const board = boardSnap.data();
            const timed = payable && result.finished;
            const newBest = timed && (!bestTicks || result.finishTick < bestTicks);

            tx.update(raceRef, { status: payable ? "finished" : "rejected", result, credited, anomaly, finishedAt: now });
            if (credited) tx.update(userRef, { ngori: balance });
            tx.set(usageRef, { motoEarnDay: today, motoEarned: earned + credited }, { merge: true });
            tx.set(
                statsRef,
                {
                    races: (stats.races || 0) + 1,
                    finished: (stats.finished || 0) + (timed ? 1 : 0),
                    medals: {
                        gold: (stats.medals?.gold || 0) + (timed && result.medal === "gold" ? 1 : 0),
                        silver: (stats.medals?.silver || 0) + (timed && result.medal === "silver" ? 1 : 0),
                        bronze: (stats.medals?.bronze || 0) + (timed && result.medal === "bronze" ? 1 : 0),
                    },
                    ...(newBest ? { bestTicks: { ...(stats.bestTicks || {}), [race.course]: result.finishTick } } : {}),
                    totalEarned: (stats.totalEarned || 0) + credited,
                    lastPlayedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            // The leaderboard only takes finished races with nothing odd about them.
            if (anomaly === null && result.finished && (!board || result.finishTick < board.bestTicks)) {
                tx.set(boardRef, {
                    firstName: profile.firstName || "Pilote",
                    photo: profile.photos?.[0] || null,
                    bestTicks: result.finishTick,
                    medal: result.medal,
                    updatedAt: now,
                });
            }
            return { credited, balance, earnedToday: earned + credited, newBest };
        });

        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: MOTO_BOMA.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la course");
    }
}

function publicEntry(doc, rank, uid) {
    const e = doc.data();
    return { rank, isMe: doc.id === uid, firstName: e.firstName, photo: e.photo, bestTicks: e.bestTicks, medal: e.medal || null };
}

// GET /api/moto-boma/leaderboard?course= → this week's 20 fastest + the caller's rank.
async function getLeaderboard(req, res) {
    const uid = req.firebaseUser.uid;
    const week = periodKey("week");
    try {
        const engine = await loadEngine();
        const course = engine.COURSES[req.query.course] ? req.query.course : engine.DEFAULT_COURSE;
        const entries = leaderboardDoc(week, course).collection("entries");
        const [topSnap, mineSnap] = await Promise.all([entries.orderBy("bestTicks", "asc").limit(20).get(), entries.doc(uid).get()]);
        const top = topSnap.docs.map((doc, i) => publicEntry(doc, i + 1, uid));
        let me = top.find((e) => e.isMe) || null;
        if (!me && mineSnap.exists) {
            const ahead = await entries.where("bestTicks", "<", mineSnap.data().bestTicks).count().get();
            me = publicEntry(mineSnap, ahead.data().count + 1, uid);
        }
        res.json({ week, course, top, me });
    } catch (err) {
        sendError(res, err, "Impossible de charger le classement");
    }
}

// GET /api/moto-boma/me → personal stats + today's progress toward the cap.
async function getMyStats(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [statsSnap, usageSnap] = await Promise.all([
            db.collection("motoBomaStats").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
        ]);
        const s = statsSnap.data() || {};
        res.json({
            stats: {
                races: s.races || 0,
                finished: s.finished || 0,
                medals: { gold: s.medals?.gold || 0, silver: s.medals?.silver || 0, bronze: s.medals?.bronze || 0 },
                bestTicks: s.bestTicks || {},
                totalEarned: s.totalEarned || 0,
            },
            earnedToday: todayUsage(usageSnap.data(), periodKey("day")).earned,
            dailyCap: MOTO_BOMA.dailyCap,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger vos statistiques");
    }
}

module.exports = { startRace, finishRace, getLeaderboard, getMyStats, anomalyOf, loadEngine };
