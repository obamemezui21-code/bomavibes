const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { MOTO_BOMA } = require("../config/ngori");
const { sendPushToUser } = require("../services/pushService");

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
        // A duel race (accepted challenge): its challenger is credited too if they win.
        const challengeRef = race.challengeId ? db.collection("motoChallenges").doc(race.challengeId) : null;
        const challengeFrom = challengeRef ? (await challengeRef.get()).data()?.from : null;
        const fromUserRef = challengeFrom ? db.collection("users").doc(challengeFrom) : null;
        const fromUsageRef = challengeFrom ? db.collection("usage").doc(challengeFrom) : null;

        const outcome = await db.runTransaction(async (tx) => {
            const [freshRace, userSnap, usageSnap, statsSnap, boardSnap, challengeSnap, fromUserSnap, fromUsageSnap] = await Promise.all([
                tx.get(raceRef),
                tx.get(userRef),
                tx.get(usageRef),
                tx.get(statsRef),
                tx.get(boardRef),
                challengeRef ? tx.get(challengeRef) : null,
                fromUserRef ? tx.get(fromUserRef) : null,
                fromUsageRef ? tx.get(fromUsageRef) : null,
            ]);
            if (freshRace.data()?.status !== "running") throw new RaceError(409, "Cette course a déjà été enregistrée.");

            const { earned } = todayUsage(usageSnap.data(), today);
            let credited = payable ? Math.max(0, Math.min(result.total, MOTO_BOMA.dailyCap - earned)) : 0;

            // Duel: the faster finish wins (a tie is a draw; not finishing loses).
            let duel = null;
            const challenge = challengeSnap?.data();
            if (challenge && challenge.status === "accepted" && challenge.to === uid) {
                const myTicks = payable && result.finished ? result.finishTick : null;
                const outcomeOf = myTicks === null ? "them" : myTicks < challenge.finishTick ? "me" : myTicks === challenge.finishTick ? "draw" : "them";
                let bonus = 0;
                if (outcomeOf === "me") {
                    bonus = Math.max(0, Math.min(MOTO_BOMA.duelWinBonus, MOTO_BOMA.dailyCap - earned - credited));
                    credited += bonus;
                } else if (outcomeOf === "them") {
                    const fromEarned = todayUsage(fromUsageSnap?.data(), today).earned;
                    bonus = Math.max(0, Math.min(MOTO_BOMA.duelWinBonus, MOTO_BOMA.dailyCap - fromEarned));
                    if (bonus) {
                        tx.update(fromUserRef, { ngori: (fromUserSnap.data()?.ngori || 0) + bonus });
                        tx.set(fromUsageRef, { motoEarnDay: today, motoEarned: fromEarned + bonus }, { merge: true });
                    }
                }
                tx.update(challengeRef, {
                    status: "done",
                    opponentTicks: myTicks,
                    winner: outcomeOf === "me" ? uid : outcomeOf === "them" ? challenge.from : null,
                    winnerBonus: bonus,
                    finishedAt: now,
                });
                duel = { outcome: outcomeOf, theirTicks: challenge.finishTick, theirName: challenge.fromName, bonus, matchId: challenge.matchId, from: challenge.from, course: challenge.course, runner: challenge.runner };
            }
            const balance = (userSnap.data()?.ngori || 0) + credited;
            const stats = statsSnap.data() || {};
            const bestTicks = stats.bestTicks?.[race.course] || null;
            const board = boardSnap.data();
            const timed = payable && result.finished;
            const newBest = timed && (!bestTicks || result.finishTick < bestTicks);

            tx.update(raceRef, {
                status: payable ? "finished" : "rejected",
                result,
                credited,
                anomaly,
                finishedAt: now,
                // Kept so the race can be sent as a duel ghost.
                ...(payable && result.finished ? { ghostInputs: engine.encodeInputs(inputs) } : {}),
            });
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
            return { credited, balance, earnedToday: earned + credited, newBest, duel };
        });

        if (outcome.duel) {
            const { duel } = outcome;
            postChallengeMessage({
                matchId: duel.matchId,
                senderId: uid,
                to: duel.from,
                challenge: { id: race.challengeId, course: duel.course, finishTick: duel.theirTicks, runner: duel.runner, firstName: duel.theirName, result: true },
                preview: "🏁 Résultat du duel Moto Boma",
                push: {
                    title: duel.outcome === "them" ? "🏆 Tu as gagné ton duel Moto Boma !" : "🏁 Ton défi Moto Boma a été relevé",
                    body: `${profile.firstName || "Ton match"} a couru contre ton fantôme. Viens voir le résultat !`,
                },
            }).catch((err) => console.error("[moto-boma] message de résultat non envoyé", err));
            delete outcome.duel.matchId;
            delete outcome.duel.from;
        }

        res.json({ result, anomaly: payable ? null : anomaly, dailyCap: MOTO_BOMA.dailyCap, ...outcome });
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer la course");
    }
}

// ---- Ghost duels between matches --------------------------------------------
// A finished race is sent to a match as a challenge: they race the same
// course on the same seed (same traffic) against its replay, once. Firestore:
//   motoChallenges/{id}  from, to, matchId, course, seed, ghostInputs,
//                        finishTick, runner, fromName, status (pending →
//                        accepted → done | expired), opponentTicks, winner
// The chat card is posted by the server (Admin SDK), between matched people only.

const RUNNERS = ["man", "woman"];

async function postChallengeMessage({ matchId, senderId, to, challenge, preview, push }) {
    const matchRef = db.collection("matches").doc(matchId);
    await matchRef.collection("messages").add({
        senderId,
        text: "",
        type: "moto-challenge",
        challenge,
        createdAt: FieldValue.serverTimestamp(),
    });
    await matchRef.update({ lastMessage: preview, lastMessageAt: FieldValue.serverTimestamp(), [`seen.${to}`]: false });
    sendPushToUser(to, { ...push, path: `/chat/${matchId}`, prefField: "notifyMessages" }).catch(() => {});
}

function challengeView(c, id, uid) {
    return {
        id,
        mine: c.from === uid,
        fromName: c.fromName,
        toName: c.toName,
        course: c.course,
        runner: c.runner,
        finishTick: c.finishTick,
        status: c.status === "pending" && Date.now() - c.createdAt > MOTO_BOMA.challengeTtlMs ? "expired" : c.status,
        opponentTicks: c.opponentTicks ?? null,
        winner: c.winner === undefined ? null : c.winner === null ? "draw" : c.winner === uid ? "me" : "them",
    };
}

// POST /api/moto-boma/challenges { raceId, matchId, runner } → { challengeId }
async function createChallenge(req, res) {
    const uid = req.firebaseUser.uid;
    const { raceId, matchId, runner } = req.body || {};
    if (typeof raceId !== "string" || typeof matchId !== "string" || !/^[A-Za-z0-9_-]{6,80}$/.test(matchId)) {
        return res.status(400).json({ message: "Défi invalide" });
    }
    try {
        const [raceSnap, matchSnap] = await Promise.all([
            db.collection("motoRaces").doc(raceId).get(),
            db.collection("matches").doc(matchId).get(),
        ]);
        const race = raceSnap.data();
        if (!race || race.uid !== uid || race.status !== "finished" || !race.result?.finished || race.anomaly || !race.ghostInputs) {
            throw new RaceError(400, "Seule une course terminée et validée peut servir de défi.");
        }
        if (race.challengeId) throw new RaceError(400, "Cette course était déjà un duel : lance une nouvelle course pour défier quelqu'un.");
        const users = matchSnap.data()?.users || [];
        if (!users.includes(uid)) throw new RaceError(404, "Conversation introuvable");
        const to = users.find((u) => u !== uid);
        if (!to) throw new RaceError(400, "Défi invalide");

        const [fromProfile, toProfile, blocked] = await Promise.all([
            db.collection("profiles").doc(uid).get(),
            db.collection("profiles").doc(to).get(),
            db.collection("blocks").doc(`${to}_${uid}`).get(),
        ]);
        if (blocked.exists) throw new RaceError(403, "Impossible d'envoyer ce défi.");
        const fromName = fromProfile.data()?.firstName || "Ton match";
        const ref = db.collection("motoChallenges").doc();
        await ref.set({
            from: uid,
            to,
            matchId,
            course: race.course,
            seed: race.seed,
            ghostInputs: race.ghostInputs,
            finishTick: race.result.finishTick,
            runner: RUNNERS.includes(runner) ? runner : "man",
            fromName,
            toName: toProfile.data()?.firstName || "",
            status: "pending",
            createdAt: Date.now(),
        });
        await postChallengeMessage({
            matchId,
            senderId: uid,
            to,
            challenge: { id: ref.id, course: race.course, finishTick: race.result.finishTick, runner: RUNNERS.includes(runner) ? runner : "man", firstName: fromName },
            preview: "🏍️ Défi Moto Boma",
            push: { title: `🏍️ ${fromName} te défie à Moto Boma !`, body: "Bats son temps sur le même parcours, face à son fantôme." },
        });
        res.json({ challengeId: ref.id });
    } catch (err) {
        sendError(res, err, "Impossible d'envoyer le défi");
    }
}

// GET /api/moto-boma/challenges/:id → the challenge as either player sees it.
async function getChallenge(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const snap = await db.collection("motoChallenges").doc(String(req.params.id)).get();
        const c = snap.data();
        if (!c || (c.from !== uid && c.to !== uid)) throw new RaceError(404, "Défi introuvable");
        res.json(challengeView(c, snap.id, uid));
    } catch (err) {
        sendError(res, err, "Impossible de charger le défi");
    }
}

// POST /api/moto-boma/challenges/:id/accept → { raceId, seed, course, ghost: { inputs, runner, name, finishTick } }
// One attempt: the race starts on the challenger's seed, with their ghost.
async function acceptChallenge(req, res) {
    const uid = req.firebaseUser.uid;
    const challengeRef = db.collection("motoChallenges").doc(String(req.params.id));
    const usageRef = db.collection("usage").doc(uid);
    const raceRef = db.collection("motoRaces").doc();
    const now = Date.now();
    const today = periodKey("day", now);
    try {
        const engine = await loadEngine();
        const challenge = await db.runTransaction(async (tx) => {
            const [snap, usageSnap] = await Promise.all([tx.get(challengeRef), tx.get(usageRef)]);
            const c = snap.data();
            if (!c || c.to !== uid) throw new RaceError(404, "Défi introuvable");
            if (c.status !== "pending") throw new RaceError(409, "Ce défi a déjà été relevé.");
            if (now - c.createdAt > MOTO_BOMA.challengeTtlMs) throw new RaceError(410, "Ce défi a expiré.");
            const { starts } = todayUsage(usageSnap.data(), today);
            if (starts >= MOTO_BOMA.maxStartsPerDay) {
                throw new RaceError(429, "Beaucoup de courses aujourd'hui ! Revenez demain pour reprendre la route.");
            }
            tx.set(usageRef, { motoDay: today, motoStarts: starts + 1, motoLastStartAt: now }, { merge: true });
            tx.set(raceRef, { uid, seed: c.seed, course: c.course, challengeId: snap.id, startedAt: now, status: "running" });
            tx.update(challengeRef, { status: "accepted", acceptedAt: now, raceId: raceRef.id });
            return c;
        });
        res.json({
            raceId: raceRef.id,
            seed: challenge.seed,
            course: challenge.course,
            ghost: {
                inputs: engine.decodeInputs(challenge.ghostInputs),
                runner: challenge.runner,
                name: challenge.fromName,
                finishTick: challenge.finishTick,
            },
        });
    } catch (err) {
        sendError(res, err, "Impossible de relever le défi");
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

module.exports = { startRace, finishRace, getLeaderboard, getMyStats, createChallenge, getChallenge, acceptChallenge, anomalyOf, loadEngine };
