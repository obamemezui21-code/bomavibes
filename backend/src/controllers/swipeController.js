const admin = require("../config/firebaseAdmin");
const { PLANS, UNLIMITED, planFor, periodKey } = require("../config/plans");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const DIRECTIONS = ["like", "pass", "superlike"];
const LIKE_DIRECTIONS = ["like", "superlike"];

class QuotaError extends Error {
    constructor(code, message) {
        super(message);
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

// POST /api/swipes { targetId, direction }
// Swipes and matches are written here (not by the app) so quotas can't be
// bypassed: free accounts get PLANS.free limits, subscribers their tier's.
async function recordSwipe(req, res) {
    const uid = req.firebaseUser.uid;
    const { targetId, direction } = req.body || {};
    if (typeof targetId !== "string" || !targetId || targetId === uid || !DIRECTIONS.includes(direction)) {
        return res.status(400).json({ message: "Requête invalide" });
    }

    const now = Date.now();
    const userRef = db.collection("users").doc(uid);
    const usageRef = db.collection("usage").doc(uid);
    const swipeRef = db.collection("swipes").doc(`${uid}_${targetId}`);

    try {
        const targetProfile = await db.collection("profiles").doc(targetId).get();
        if (!targetProfile.exists) return res.status(404).json({ message: "Profil introuvable" });

        let plan = PLANS.free;
        let usageAfter = null;
        await db.runTransaction(async (tx) => {
            const [userSnap, usageSnap, prevSwipe] = await Promise.all([tx.get(userRef), tx.get(usageRef), tx.get(swipeRef)]);
            plan = planFor(userSnap.data(), now);
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

            tx.set(swipeRef, { swiperId: uid, targetId, direction, createdAt: FieldValue.serverTimestamp() });
            if (Object.keys(update).length) tx.set(usageRef, update, { merge: true });
            usageAfter = { ...usage, ...update };
        });

        let matchId = null;
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
                if (created) {
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

        res.json({ matchId, remaining: remainingFor(plan, usageAfter, now) });
    } catch (err) {
        if (err instanceof QuotaError) {
            return res.status(429).json({ code: err.code, message: err.message });
        }
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer votre choix" });
    }
}

// GET /api/swipes/quota — what's left today / this week, for the UI.
async function getQuota(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const [userSnap, usageSnap] = await Promise.all([
            db.collection("users").doc(uid).get(),
            db.collection("usage").doc(uid).get(),
        ]);
        const plan = planFor(userSnap.data());
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
            .map((s) => ({ id: s.swiperId, superlike: s.direction === "superlike" }));

        if (!planFor(userSnap.data()).seeLikes) {
            return res.json({ locked: true, count: likerIds.length, likers: [] });
        }

        const profiles = await Promise.all(
            likerIds.map(async ({ id, superlike }) => {
                const p = (await db.collection("profiles").doc(id).get()).data();
                if (!p) return null;
                return {
                    id,
                    superlike,
                    firstName: p.firstName || "",
                    age: p.age || null,
                    city: p.city || null,
                    country: p.country || null,
                    photos: p.photos || [],
                    bio: p.bio || null,
                    interests: p.interests || [],
                    verified: !!p.verified,
                    datingGoal: p.datingGoal || null,
                };
            }),
        );
        res.json({ locked: false, count: likerIds.length, likers: profiles.filter(Boolean) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { recordSwipe, getQuota, getIncomingLikesCount, getIncomingLikers };
