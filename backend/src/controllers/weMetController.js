const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// "We Met" (as on Hinge): a few days after a match started talking, each
// member is asked privately whether they met in person and would like to
// see the person again. The other person never sees the answer.
// Firestore: weMet/{matchId}_{uid}  matchId, uid, otherId, met (yes | no |
// not_yet), seeAgain, uncomfortable, askAgainAt, updatedAt.
// "Uncomfortable" also files a report for the moderation team.

const SYSTEM_ACCOUNT_ID = "bomavibes-team";
const DAY_MS = 24 * 60 * 60 * 1000;
const ASK_AFTER_DAYS = 3;
const SNOOZE_DAYS = 7;
const ANSWERS = ["yes", "no", "not_yet"];

async function loadMatch(matchId, uid) {
    if (typeof matchId !== "string" || !matchId || matchId.includes("/")) return null;
    const snap = await db.collection("matches").doc(matchId).get();
    const match = snap.data();
    if (!match?.users?.includes(uid)) return null;
    const otherId = match.users.find((u) => u !== uid);
    if (!otherId || otherId === SYSTEM_ACCOUNT_ID) return null;
    return { ...match, otherId };
}

// Ask once the match is a few days old and the two have talked, unless
// already answered ("pas encore" asks again a week later).
function shouldAsk(match, feedback, now) {
    const createdAt = match.createdAt?.toMillis?.();
    if (!createdAt || now - createdAt < ASK_AFTER_DAYS * DAY_MS) return false;
    if (!match.lastMessage) return false;
    if (!feedback) return true;
    return feedback.met === "not_yet" && (feedback.askAgainAt?.toMillis?.() || 0) <= now;
}

// GET /api/we-met/:matchId → { ask }
async function getWeMet(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const match = await loadMatch(req.params.matchId, uid);
        if (!match) return res.json({ ask: false });
        const feedback = (await db.collection("weMet").doc(`${req.params.matchId}_${uid}`).get()).data();
        res.json({ ask: shouldAsk(match, feedback, Date.now()) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// POST /api/we-met/:matchId { met, seeAgain, uncomfortable }
async function answerWeMet(req, res) {
    const uid = req.firebaseUser.uid;
    const { matchId } = req.params;
    const { met, seeAgain = null, uncomfortable = false } = req.body || {};
    if (!ANSWERS.includes(met) || (seeAgain !== null && typeof seeAgain !== "boolean") || typeof uncomfortable !== "boolean") {
        return res.status(400).json({ message: "Requête invalide" });
    }
    try {
        const match = await loadMatch(matchId, uid);
        if (!match) return res.status(404).json({ message: "Conversation introuvable" });

        await db.collection("weMet").doc(`${matchId}_${uid}`).set({
            matchId,
            uid,
            otherId: match.otherId,
            met,
            seeAgain: met === "yes" ? seeAgain : null,
            uncomfortable,
            askAgainAt: met === "not_yet" ? admin.firestore.Timestamp.fromMillis(Date.now() + SNOOZE_DAYS * DAY_MS) : null,
            updatedAt: FieldValue.serverTimestamp(),
        });

        if (uncomfortable) {
            await db.collection("reports").add({
                reporterId: uid,
                reportedUserId: match.otherId,
                reason: "Autre",
                description: "We Met : la personne dit s'être sentie mal à l'aise lors du rendez-vous.",
                status: "pending",
                source: "we_met",
                contextRef: { matchId },
                createdAt: FieldValue.serverTimestamp(),
            });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { shouldAsk, getWeMet, answerWeMet };
