const admin = require("../config/firebaseAdmin");
const { UNLIMITED, planFor, toMillis } = require("../config/plans");
const { REWARDS, STREAK_LENGTH, VERIFIED_DAILY_BONUS, dailyClaim, streakBadgeFor } = require("../config/ngori");

const db = admin.firestore();
const { Timestamp } = admin.firestore;

class NgoriError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function walletOf(userData, now = Date.now()) {
    return {
        balance: userData?.ngori || 0,
        streak: userData?.ngoriStreak || 0,
        streakLength: STREAK_LENGTH,
        claimedToday: dailyClaim(userData, now) === null,
    };
}

// GET /api/ngori — balance, streak and whether today's coin is still waiting.
async function getWallet(req, res) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        res.json(walletOf(snap.data()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// POST /api/ngori/claim — today's coin (+ the streak bonus). Idempotent: a
// second call the same day just returns { gained: 0 }. Also refreshes the
// public 🔥 streak badge (profiles/{uid}.streakBadge + streakDay, so the app
// can hide a badge whose streak has since lapsed).
async function claimDaily(req, res) {
    const userRef = db.collection("users").doc(req.firebaseUser.uid);
    const profileRef = db.collection("profiles").doc(req.firebaseUser.uid);
    const now = Date.now();
    try {
        const result = await db.runTransaction(async (tx) => {
            const [snap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
            if (!snap.exists) throw new NgoriError(404, "Utilisateur introuvable");
            const data = snap.data();
            const claim = dailyClaim(data, now);
            if (!claim) return { gained: 0, bonus: 0, ...walletOf(data, now) };
            // Verified identity: one more Ngori every day (reported apart
            // from the streak bonus).
            const verifiedBonus = profileSnap.data()?.verified ? VERIFIED_DAILY_BONUS : 0;
            claim.gained += verifiedBonus;
            const balance = (data.ngori || 0) + claim.gained;
            tx.update(userRef, { ngori: balance, ngoriStreak: claim.streak, ngoriLastClaimDay: claim.day });
            tx.set(profileRef, { streakBadge: streakBadgeFor(claim.streak), streakDay: claim.day }, { merge: true });
            return { gained: claim.gained, bonus: claim.bonus, verifiedBonus, balance, streak: claim.streak, streakLength: STREAK_LENGTH, claimedToday: true };
        });
        res.json(result);
    } catch (err) {
        if (err instanceof NgoriError) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible de récupérer vos Ngori" });
    }
}

// POST /api/ngori/redeem { reward } — spends Ngori on a time-limited perk.
// Buying a perk already running extends it from its current end.
async function redeemReward(req, res) {
    const uid = req.firebaseUser.uid;
    const rewardId = req.body?.reward;
    const reward = Object.hasOwn(REWARDS, rewardId) ? REWARDS[rewardId] : null;
    if (!reward) return res.status(400).json({ message: "Récompense inconnue" });

    const userRef = db.collection("users").doc(uid);
    const profileRef = db.collection("profiles").doc(uid);
    const now = Date.now();
    try {
        const result = await db.runTransaction(async (tx) => {
            const [userSnap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
            if (!userSnap.exists) throw new NgoriError(404, "Utilisateur introuvable");
            const data = userSnap.data();
            const plan = planFor(data, now);

            const alreadyIncluded =
                (rewardId === "unlimited_likes" && plan.likesPerDay === UNLIMITED) || (reward.planFlag && plan[reward.planFlag]);
            if (alreadyIncluded) throw new NgoriError(409, `${reward.label} : déjà inclus dans votre forfait.`);

            const balance = data.ngori || 0;
            if (balance < reward.cost) {
                throw new NgoriError(402, `Il vous faut ${reward.cost} Ngori (vous en avez ${balance}).`);
            }

            let until;
            if (reward.perk) {
                until = Math.max(now, toMillis(data.perks?.[reward.perk])) + reward.durationMs;
                tx.update(userRef, { ngori: balance - reward.cost, [`perks.${reward.perk}`]: Timestamp.fromMillis(until) });
            } else {
                if (toMillis(profileSnap.data()?.boostedUntil) > now) throw new NgoriError(409, "Un Boost est déjà en cours.");
                until = now + reward.durationMs;
                tx.update(userRef, { ngori: balance - reward.cost });
                tx.set(profileRef, { boostedUntil: Timestamp.fromMillis(until) }, { merge: true });
            }
            return { reward: rewardId, until, balance: balance - reward.cost };
        });
        res.json(result);
    } catch (err) {
        if (err instanceof NgoriError) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible d'utiliser vos Ngori" });
    }
}

module.exports = { getWallet, claimDaily, redeemReward };
