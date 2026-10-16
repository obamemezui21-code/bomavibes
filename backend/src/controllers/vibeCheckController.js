const admin = require("../config/firebaseAdmin");
const { periodKey, toMillis } = require("../config/plans");
const { VIBE_CHECK } = require("../config/ngori");
const { QUESTIONS, QUESTIONS_PER_DAY } = require("../config/vibeCheckQuestions");
const { profileCanInteract } = require("../services/identityAccess");
const { sendPushToUser } = require("../services/pushService");
const { applySwipe, sendSwipeError } = require("./swipeController");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// VIBE CHECK — blind matching. Every day everyone answers the same "ceci ou
// cela" questions; the server compares the answers and shows each player
// the members they vibe with most, photo hidden. Sending a vibe is a real
// like (same quotas as Discover, via applySwipe): the photo is revealed, the
// other side is told someone has X % of vibe with them, and a vibe sent back
// makes a match.
//
// Firestore (Admin SDK only — no client rule opens these):
//   vibeAnswers/{uid}         answers { questionId: 0|1 }, gender, pref, lastDay
//   vibes/{from}_{to}         from, to, percent, createdAt
//   usage/{uid}.vibe*         the day the play reward / match reward was paid

let scorePromise = null;
function loadScore() {
    scorePromise ||= import("../../../shared/vibe-check/score.mjs");
    return scorePromise;
}

class VibeError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof VibeError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_DAY = "2026-10-15";
const PREFS = ["FEMME", "HOMME", "TOUS"];
const SYSTEM_ACCOUNT_ID = "bomavibes-team";
// Players who haven't answered for this long drop out of everyone's results.
const ACTIVE_DAYS = 60;
const RESULTS_SIZE = 8;

const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const WEIGHTS = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.weight || 1]));

function dayNumber(day) {
    return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY_MS);
}

async function questionsForDay(day) {
    const { dayQuestionIndexes } = await loadScore();
    return dayQuestionIndexes(dayNumber(day), QUESTIONS.length, QUESTIONS_PER_DAY).map((i) => QUESTIONS[i]);
}

const publicQuestion = (q) => ({ id: q.id, text: q.text, a: q.a, b: q.b });

// GET /api/vibe-check → { day, questions, myAnswers, pref, gender, playedToday, rewards }
async function getToday(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    try {
        const [questions, mineSnap, profileSnap] = await Promise.all([
            questionsForDay(day),
            db.collection("vibeAnswers").doc(uid).get(),
            db.collection("profiles").doc(uid).get(),
        ]);
        const mine = mineSnap.data() || {};
        res.json({
            day,
            questions: questions.map(publicQuestion),
            myAnswers: Object.fromEntries(questions.filter((q) => q.id in (mine.answers || {})).map((q) => [q.id, mine.answers[q.id]])),
            pref: mine.pref || null,
            gender: profileSnap.data()?.gender || null,
            playedToday: mine.lastDay === day,
            rewards: VIBE_CHECK,
        });
    } catch (err) {
        sendError(res, err, "Impossible de charger le Vibe Check");
    }
}

// POST /api/vibe-check/answers { day, pref, answers: { questionId: 0|1 } }
// Every question of the day must be answered. Pays the play reward once a day.
async function submitAnswers(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    const { pref, answers } = req.body || {};
    if (req.body?.day && req.body.day !== day) {
        return res.status(409).json({ message: "De nouvelles questions viennent d’arriver ! Recharge la page." });
    }
    if (!PREFS.includes(pref)) return res.status(400).json({ message: "Dis-nous qui tu veux rencontrer." });
    try {
        const questions = await questionsForDay(day);
        const todays = {};
        for (const q of questions) {
            const a = answers?.[q.id];
            if (a !== 0 && a !== 1) throw new VibeError(400, "Réponds à toutes les questions du jour.");
            todays[q.id] = a;
        }
        const profile = (await db.collection("profiles").doc(uid).get()).data() || {};
        const answersRef = db.collection("vibeAnswers").doc(uid);
        const usageRef = db.collection("usage").doc(uid);
        const userRef = db.collection("users").doc(uid);

        const credited = await db.runTransaction(async (tx) => {
            const [mineSnap, usageSnap] = await Promise.all([tx.get(answersRef), tx.get(usageRef)]);
            const mine = mineSnap.data() || {};
            tx.set(answersRef, {
                answers: { ...(mine.answers || {}), ...todays },
                pref,
                gender: profile.gender || null,
                lastDay: day,
                updatedAt: FieldValue.serverTimestamp(),
            });
            if (usageSnap.data()?.vibeDay === day) return 0;
            tx.set(usageRef, { vibeDay: day }, { merge: true });
            tx.update(userRef, { ngori: FieldValue.increment(VIBE_CHECK.playReward) });
            return VIBE_CHECK.playReward;
        });
        res.json({ credited });
    } catch (err) {
        sendError(res, err, "Impossible d’enregistrer tes réponses");
    }
}

// The shared answers worth showing on a card: the ones that matter most first.
function agreedView(agreedOn, answers) {
    return agreedOn
        .map((id) => QUESTION_BY_ID.get(id))
        .filter(Boolean)
        .sort((a, b) => (b.weight || 1) - (a.weight || 1))
        .slice(0, 5)
        .map((q) => ({ text: q.text, choice: answers[q.id] === 0 ? q.a : q.b }));
}

// Everyone the player must not be shown: matched, blocked either way, passed.
async function excludedIds(uid) {
    const [matches, blockedByMe, blockingMe, swipes] = await Promise.all([
        db.collection("matches").where("users", "array-contains", uid).get(),
        db.collection("blocks").where("blockerId", "==", uid).get(),
        db.collection("blocks").where("blockedId", "==", uid).get(),
        db.collection("swipes").where("swiperId", "==", uid).get(),
    ]);
    const out = new Set([uid, SYSTEM_ACCOUNT_ID]);
    matches.docs.forEach((d) => (d.data().users || []).forEach((u) => out.add(u)));
    blockedByMe.docs.forEach((d) => out.add(d.data().blockedId));
    blockingMe.docs.forEach((d) => out.add(d.data().blockerId));
    swipes.docs.forEach((d) => d.data().direction === "pass" && out.add(d.data().targetId));
    return out;
}

function eligibleProfile(p, now) {
    if (!p || !profileCanInteract(p)) return false;
    // Invisible mode (Jadéite Impériale) hides the profile everywhere.
    return !(p.invisible && toMillis(p.visibilityUntil) > now);
}

// GET /api/vibe-check/results → { needsPlay } or { received: [card], top: [card] }
// A card: id, firstName, age, city, verified, percent, common, agreed,
// photo (only once the player sent their vibe), vibeSent, vibeReceived.
// Note: reads every recent player's answers on each call — fine for now;
// past a few thousand players, cache the results per player and day.
async function getResults(req, res) {
    const uid = req.firebaseUser.uid;
    const now = Date.now();
    try {
        const { vibeScore, mutualFit } = await loadScore();
        const mine = (await db.collection("vibeAnswers").doc(uid).get()).data();
        if (!mine?.answers) return res.json({ needsPlay: true, received: [], top: [] });

        const cutoff = periodKey("day", now - ACTIVE_DAYS * DAY_MS);
        const [pool, excluded, sentSnap, receivedSnap] = await Promise.all([
            db.collection("vibeAnswers").where("lastDay", ">=", cutoff).get(),
            excludedIds(uid),
            db.collection("vibes").where("from", "==", uid).get(),
            db.collection("vibes").where("to", "==", uid).get(),
        ]);
        const sent = new Set(sentSnap.docs.map((d) => d.data().to));
        const receivedFrom = new Map(receivedSnap.docs.map((d) => [d.data().from, d.data().percent]));
        const players = new Map(pool.docs.map((d) => [d.id, d.data()]));

        const scored = [];
        for (const [id, other] of players) {
            if (excluded.has(id)) continue;
            const received = receivedFrom.has(id);
            // Someone who sent a vibe is always shown; the rest must fit both ways.
            if (!received && !mutualFit(mine, other)) continue;
            const score = vibeScore(mine.answers, other.answers, WEIGHTS);
            if (!score && !received) continue;
            scored.push({ id, other, score, received });
        }
        // Senders whose answers aged out of the pool still deserve a card.
        for (const [id] of receivedFrom) {
            if (!players.has(id) && !excluded.has(id)) scored.push({ id, other: {}, score: null, received: true });
        }
        scored.sort((a, b) => Number(b.received) - Number(a.received) || (b.score?.rank || 0) - (a.score?.rank || 0));

        const shortlist = scored.slice(0, RESULTS_SIZE * 4);
        const profileSnaps = shortlist.length ? await db.getAll(...shortlist.map((e) => db.collection("profiles").doc(e.id))) : [];
        const cards = [];
        let topCount = 0;
        shortlist.forEach((entry, i) => {
            if (!entry.received && topCount >= RESULTS_SIZE) return;
            const p = profileSnaps[i].data();
            if (!eligibleProfile(p, now)) return;
            const vibeSent = sent.has(entry.id);
            cards.push({
                id: entry.id,
                firstName: p.firstName || "Mystère",
                age: p.hideAge ? null : p.age || null,
                city: p.city || null,
                verified: !!p.verified,
                percent: entry.score?.percent ?? receivedFrom.get(entry.id) ?? null,
                common: entry.score?.common || 0,
                agreed: entry.score ? agreedView(entry.score.agreedOn, mine.answers) : [],
                photo: vibeSent ? p.photos?.[0] || null : null,
                vibeSent,
                vibeReceived: entry.received,
            });
            if (!entry.received) topCount++;
        });
        res.json({
            needsPlay: false,
            received: cards.filter((c) => c.vibeReceived),
            top: cards.filter((c) => !c.vibeReceived),
        });
    } catch (err) {
        sendError(res, err, "Impossible de calculer tes vibes");
    }
}

// POST /api/vibe-check/vibe { targetId } → { matchId, photo, percent, credited }
async function sendVibe(req, res) {
    const uid = req.firebaseUser.uid;
    const { targetId } = req.body || {};
    if (typeof targetId !== "string" || !/^[A-Za-z0-9_-]{6,128}$/.test(targetId) || targetId === uid) {
        return res.status(400).json({ message: "Profil introuvable" });
    }
    const now = Date.now();
    const day = periodKey("day", now);
    try {
        const { vibeScore, mutualFit } = await loadScore();
        const [mineSnap, theirsSnap, profileSnap, receivedSnap, excluded] = await Promise.all([
            db.collection("vibeAnswers").doc(uid).get(),
            db.collection("vibeAnswers").doc(targetId).get(),
            db.collection("profiles").doc(targetId).get(),
            db.collection("vibes").doc(`${targetId}_${uid}`).get(),
            excludedIds(uid),
        ]);
        const mine = mineSnap.data();
        const theirs = theirsSnap.data();
        const profile = profileSnap.data();
        if (!mine || !eligibleProfile(profile, now)) throw new VibeError(404, "Profil introuvable");
        if (excluded.has(targetId)) throw new VibeError(409, "Ce profil n’est plus disponible ici.");
        const score = theirs ? vibeScore(mine.answers, theirs.answers, WEIGHTS) : null;
        // Only someone the game itself could have shown: a fit with enough in common, or a sender.
        if (!receivedSnap.exists && (!score || !mutualFit(mine, theirs))) {
            throw new VibeError(400, "Pas encore assez de réponses en commun avec ce profil.");
        }
        const percent = score?.percent ?? receivedSnap.data()?.percent ?? null;

        const { matchId, matchCreated } = await applySwipe(uid, targetId, "like");

        const vibeRef = db.collection("vibes").doc(`${uid}_${targetId}`);
        const firstVibe = !(await vibeRef.get()).exists;
        await vibeRef.set({ from: uid, to: targetId, percent, createdAt: FieldValue.serverTimestamp() });

        let credited = 0;
        if (matchCreated) {
            // A match born in the game: both sides get the match reward, once a day each.
            credited = await db.runTransaction(async (tx) => {
                const refs = [uid, targetId].map((id) => ({ usage: db.collection("usage").doc(id), user: db.collection("users").doc(id) }));
                const usages = await Promise.all(refs.map((r) => tx.get(r.usage)));
                let mineCredited = 0;
                refs.forEach((r, i) => {
                    if (usages[i].data()?.vibeMatchDay === day) return;
                    tx.set(r.usage, { vibeMatchDay: day }, { merge: true });
                    tx.update(r.user, { ngori: FieldValue.increment(VIBE_CHECK.matchReward) });
                    if (i === 0) mineCredited = VIBE_CHECK.matchReward;
                });
                return mineCredited;
            });
        } else if (firstVibe) {
            sendPushToUser(targetId, {
                title: percent != null ? `💜 Quelqu’un a ${percent} % de vibe avec toi !` : "💜 Quelqu’un t’a envoyé sa vibe !",
                body: "Joue au Vibe Check pour découvrir qui c’est.",
                path: "/vibe-check",
                prefField: "notifyMatches",
            }).catch(() => {});
        }

        res.json({ matchId, photo: profile.photos?.[0] || null, percent, credited });
    } catch (err) {
        if (err instanceof VibeError) return sendError(res, err);
        sendSwipeError(res, err);
    }
}

module.exports = { getToday, submitAnswers, getResults, sendVibe };
