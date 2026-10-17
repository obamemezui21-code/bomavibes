const admin = require("../config/firebaseAdmin");
const { canInteract, IDENTITY_REQUIRED_MESSAGE, isVerified, VERIFIED_ONLY_MESSAGE } = require("../services/identityAccess");
const { PLANS, UNLIMITED, periodKey } = require("../config/plans");
const { effectivePlanFor } = require("../config/ngori");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const DIRECTIONS = ["like", "pass", "superlike"];
const LIKE_DIRECTIONS = ["like", "superlike"];
const COMPLIMENT_MAX = 200;
const COMPLIMENT_ABOUT_MAX = 300;

// A compliment is a short note sent with a like (Hinge comments / Bumble
// compliments): { text, about } where about quotes what it answers (the
// bio or a profile prompt), or null. → the cleaned compliment, null when
// absent, undefined when invalid.
function parseCompliment(raw) {
    if (raw == null) return null;
    if (typeof raw !== "object") return undefined;
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text || text.length > COMPLIMENT_MAX) return undefined;
    const about = typeof raw.about === "string" ? raw.about.trim().slice(0, COMPLIMENT_ABOUT_MAX) : "";
    return { text, about: about || null };
}

class QuotaError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

// A swipe refused before any quota is counted (status + code for the response).
class SwipeError extends Error {
    constructor(status, message, code = null) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// Counts already used in the current window (0 when the stored window is old).
function used(usage, keyField, countField, key) {
    return usage?.[keyField] === key ? usage[countField] || 0 : 0;
}

function remainingFor(plan, usage, now) {
    const likesLeft =
        plan.likesPerDay === UNLIMITED ? null : Math.max(0, plan.likesPerDay - used(usage, "likesDay", "likes", periodKey("day", now)));
    const superKey = periodKey(plan.superlikes.period, now);
    const superLeft = Math.max(0, plan.superlikes.count - used(usage, "superPeriod", "superlikes", superKey));
    return { likes: likesLeft, superlikes: superLeft };
}

// Records uid's swipe on targetId and creates the match when the like is
// mutual. Discover (recordSwipe below) and VIBE CHECK both go through here,
// so quotas apply the same way. → { matchId, matchCreated, remaining }
// Throws QuotaError (likes used up) or SwipeError.
async function applySwipe(uid, targetId, direction, compliment = null) {
    const now = Date.now();
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const swipeRef = db.collection("swipes").doc(`${uid}_${targetId}`);

    // Likes need a verified identity (passing a profile doesn't).
    if (LIKE_DIRECTIONS.includes(direction) && !(await canInteract(uid))) {
        throw new SwipeError(403, IDENTITY_REQUIRED_MESSAGE, "identity_required");
    }
    if (direction === "superlike" && !(await isVerified(uid))) {
        throw new SwipeError(403, VERIFIED_ONLY_MESSAGE, "verified_only");
    }
    const targetProfile = await db.collection("profiles").doc(targetId).get();
    if (!targetProfile.exists) throw new SwipeError(404, "Profil introuvable");

    let plan = PLANS.free;
    let usageAfter = null;
    await db.runTransaction(async (tx) => {
        const [userSnap, usageSnap, prevSwipe, mySnap] = await Promise.all([
            tx.get(userRef),
            tx.get(usageRef),
            tx.get(swipeRef),
            tx.get(db.collection("profiles").doc(uid)),
        ]);
        plan = effectivePlanFor(userSnap.data(), now, mySnap.data());
        const usage = usageSnap.data() || {};
        const wasLiked = LIKE_DIRECTIONS.includes(prevSwipe.data()?.direction);
        const update = {};

        if (direction === "like" && !wasLiked && plan.likesPerDay !== UNLIMITED) {
            const day = periodKey("day", now);
            const count = used(usage, "likesDay", "likes", day);
            if (count >= plan.likesPerDay) {
                throw new QuotaError("LIKE_LIMIT", `Vous avez utilisé vos ${plan.likesPerDay} likes du jour.`);
            }
            Object.assign(update, { likesDay: day, likes: count + 1 });
        }

        if (direction === "superlike" && prevSwipe.data()?.direction !== "superlike") {
            const key = periodKey(plan.superlikes.period, now);
            const count = used(usage, "superPeriod", "superlikes", key);
            if (count >= plan.superlikes.count) {
                const when = plan.superlikes.period === "day" ? "aujourd'hui" : "cette semaine";
                throw new QuotaError("SUPERLIKE_LIMIT", `Vous avez utilisé tous vos Super Likes ${when}.`);
            }
            Object.assign(update, { superPeriod: key, superlikes: count + 1 });
        }

        tx.set(swipeRef, {
            swiperId: uid,
            targetId,
            direction,
            createdAt: FieldValue.serverTimestamp(),
            ...(compliment && LIKE_DIRECTIONS.includes(direction) ? { compliment } : {}),
        });
        if (Object.keys(update).length) tx.set(usageRef, update, { merge: true });
        usageAfter = { ...usage, ...update };
    });

    let matchId = null;
    let matchCreated = false;
    if (LIKE_DIRECTIONS.includes(direction)) {
        const [reciprocal, blockA, blockB] = await Promise.all([
            db.collection("swipes").doc(`${targetId}_${uid}`).get(),
            db.collection("blocks").doc(`${uid}_${targetId}`).get(),
            db.collection("blocks").doc(`${targetId}_${uid}`).get(),
        ]);
        const mutual = LIKE_DIRECTIONS.includes(reciprocal.data()?.direction);
        if (mutual && !blockA.exists && !blockB.exists) {
            matchId = [uid, targetId].sort().join("_");
            const matchRef = db.collection("matches").doc(matchId);
            const created = await db.runTransaction(async (tx) => {
                if ((await tx.get(matchRef)).exists) return false;
                tx.set(matchRef, {
                    users: [uid, targetId].sort(),
                    createdAt: FieldValue.serverTimestamp(),
                    lastMessage: null,
                    lastMessageAt: FieldValue.serverTimestamp(),
                    seen: { [uid]: true, [targetId]: false },
                });
                return true;
            });
            matchCreated = created;
            if (created) {
                // Compliments sent with either like open the conversation,
                // the older one first.
                await postCompliments(matchId, [reciprocal.data(), { swiperId: uid, compliment }]).catch((err) =>
                    console.error("Posting compliments failed:", err.message),
                );
                const me = (await db.collection("profiles").doc(uid).get()).data();
                sendPushToUser(targetId, {
                    title: "Nouveau match !",
                    body: me?.firstName ? `Vous et ${me.firstName} vous êtes plu mutuellement.` : "Vous avez un nouveau match.",
                    path: "/matches",
                    prefField: "notifyMatches",
                });
            }
        }
    }

    if (compliment && !matchId && LIKE_DIRECTIONS.includes(direction)) {
        sendPushToUser(targetId, {
            title: "Nouveau compliment 💬",
            body: "Quelqu'un vous a envoyé un compliment avec son like.",
            path: "/likes",
            prefField: "notifyMatches",
        }).catch(() => {});
    }

    return { matchId, matchCreated, remaining: remainingFor(plan, usageAfter, now) };
}

// swipes: [{ swiperId, compliment }] in the order they were made.
async function postCompliments(matchId, swipes) {
    const matchRef = db.collection("matches").doc(matchId);
    let last = null;
    for (const { swiperId, compliment } of swipes) {
        if (!compliment?.text) continue;
        await matchRef.collection("messages").add({
            senderId: swiperId,
            text: compliment.text,
            type: "compliment",
            about: compliment.about || null,
            createdAt: FieldValue.serverTimestamp(),
        });
        last = compliment.text;
    }
    if (last) await matchRef.update({ lastMessage: last.slice(0, 500), lastMessageAt: FieldValue.serverTimestamp() });
}

function sendSwipeError(res, err) {
    if (err instanceof QuotaError) return res.status(429).json({ code: err.code, message: err.message });
    if (err instanceof SwipeError) return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    console.error(err);
    res.status(500).json({ message: "Impossible d'enregistrer votre choix" });
}

// POST /api/swipes { targetId, direction }
// Swipes and matches are written here (not by the app) so quotas can't be
// bypassed: free accounts get PLANS.free limits, subscribers their tier's.
async function recordSwipe(req, res) {
    const uid = req.firebaseUser.uid;
    const { targetId, direction } = req.body || {};
    const compliment = parseCompliment(req.body?.compliment);
    if (typeof targetId !== "string" || !targetId || targetId === uid || !DIRECTIONS.includes(direction) || compliment === undefined) {
        return res.status(400).json({ message: "Requête invalide" });
    }
    try {
        const { matchId, remaining } = await applySwipe(uid, targetId, direction, compliment);
        res.json({ matchId, remaining });
    } catch (err) {
        sendSwipeError(res, err);
    }
}

// GET /api/swipes/quota — what's left today / this week, for the UI.
async function getQuota(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [userSnap, usageSnap, profileSnap] = await Promise.all([
            db.collection("users").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
            db.collection("profiles").doc(uid).get(),
        ]);
        const plan = effectivePlanFor(userSnap.data(), Date.now(), profileSnap.data());
        res.json({ remaining: remainingFor(plan, usageSnap.data(), Date.now()) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

function incomingLikesQuery(uid) {
    return db.collection("swipes").where("targetId", "==", uid).where("direction", "in", LIKE_DIRECTIONS);
}

// GET /api/swipes/likes-count — for every account (the "Likes" tiles).
async function getIncomingLikesCount(req, res) {
    try {
        const snap = await incomingLikesQuery(req.firebaseUser.uid).count().get();
        res.json({ count: snap.data().count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// GET /api/swipes/likers — "Voir qui vous aime": the actual profiles for
// subscribers only; free accounts just get how many are waiting.
async function getIncomingLikers(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [userSnap, likesSnap, mySwipesSnap, blockedByMe, blockingMe] = await Promise.all([
            db.collection("users").doc(uid).get(),
            incomingLikesQuery(uid).get(),
            db.collection("swipes").where("swiperId", "==", uid).get(),
            db.collection("blocks").where("blockerId", "==", uid).get(),
            db.collection("blocks").where("blockedId", "==", uid).get(),
        ]);
        const answered = new Set(mySwipesSnap.docs.map((d) => d.data().targetId));
        const blocked = new Set([
            ...blockedByMe.docs.map((d) => d.data().blockedId),
            ...blockingMe.docs.map((d) => d.data().blockerId),
        ]);
        // Still waiting for an answer from this user.
        const likerIds = likesSnap.docs
            .map((d) => d.data())
            .filter((s) => !answered.has(s.swiperId) && !blocked.has(s.swiperId))
            .map((s) => ({ id: s.swiperId, superlike: s.direction === "superlike", compliment: s.compliment || null }));

        if (!effectivePlanFor(userSnap.data()).seeLikes) {
            // Free accounts read the compliments, just not who sent them.
            const compliments = likerIds.filter((l) => l.compliment).map((l) => l.compliment);
            return res.json({ locked: true, count: likerIds.length, likers: [], compliments });
        }

        const profiles = await Promise.all(
            likerIds.map(async ({ id, superlike, compliment }) => {
                const p = (await db.collection("profiles").doc(id).get()).data();
                if (!p) return null;
                return {
                    id,
                    superlike,
                    compliment,
                    firstName: p.firstName || "",
                    age: p.age || null,
                    city: p.city || null,
                    country: p.country || null,
                    photos: p.photos || [],
                    bio: p.bio || null,
                    interests: p.interests || [],
                    verified: !!p.verified,
                    datingGoal: p.datingGoal || null,
                    prompts: p.prompts || [],
                    hideAge: !!p.hideAge,
                };
            }),
        );
        res.json({ locked: false, count: likerIds.length, likers: profiles.filter(Boolean) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { parseCompliment, applySwipe, sendSwipeError, recordSwipe, getQuota, getIncomingLikesCount, getIncomingLikers };
