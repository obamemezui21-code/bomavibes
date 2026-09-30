const admin = require("../config/firebaseAdmin");
const { PLANS, PAID_PLANS, BOOST_DURATION_MS, activePlanId, planFor, periodKey, toMillis } = require("../config/plans");
const { logAdminAction } = require("../services/adminLogService");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const DAY_MS = 24 * 60 * 60 * 1000;

// PATCH /api/admin/subscriptions/:uid { plan: 'vip'|'diamant'|'jade'|null, days }
// Manual activation while online payment isn't wired up: the user pays by
// Mobile Money, an admin records it here. Renewing the same plan extends it
// from its current end date; any other change starts from today.
async function setUserPlan(req, res) {
    const { uid } = req.params;
    const { plan, days } = req.body || {};
    const cancelling = plan === null;
    if (!cancelling && (!PAID_PLANS.includes(plan) || !Number.isInteger(days) || days < 1 || days > 400)) {
        return res.status(400).json({ message: "Forfait ou durée invalide" });
    }

    try {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).json({ message: "Utilisateur introuvable" });

        const profileRef = db.collection("profiles").doc(uid);
        const batch = db.batch();

        if (cancelling) {
            batch.update(userRef, { plan: null, planExpiresAt: null, planUpdatedAt: FieldValue.serverTimestamp(), planUpdatedBy: req.firebaseUser.uid });
            batch.set(profileRef, { visibility: 0, visibilityUntil: null, invisible: false, boostedUntil: null }, { merge: true });
        } else {
            const now = Date.now();
            const current = userSnap.data();
            const from = activePlanId(current, now) === plan ? Math.max(now, toMillis(current.planExpiresAt)) : now;
            const expiresAt = Timestamp.fromMillis(from + days * DAY_MS);
            batch.update(userRef, {
                plan,
                planExpiresAt: expiresAt,
                planUpdatedAt: FieldValue.serverTimestamp(),
                planUpdatedBy: req.firebaseUser.uid,
            });
            // Public, read by everyone's Discover ranking.
            batch.set(
                profileRef,
                { visibility: PLANS[plan].visibility, visibilityUntil: expiresAt, ...(PLANS[plan].invisible ? {} : { invisible: false }) },
                { merge: true },
            );
        }
        await batch.commit();

        await logAdminAction(req, {
            action: cancelling ? "CANCEL_SUBSCRIPTION" : "SET_SUBSCRIPTION",
            targetType: "user",
            targetId: uid,
            metadata: cancelling ? null : { plan, days },
        });

        const updated = (await userRef.get()).data();
        if (!cancelling) {
            const until = new Date(toMillis(updated.planExpiresAt)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
            sendPushToUser(uid, {
                title: `Forfait ${PLANS[plan].label} activé 🎉`,
                body: `Profitez de vos avantages jusqu'au ${until}.`,
                path: "/profile",
            });
        }
        res.json({ plan: activePlanId(updated), planExpiresAt: toMillis(updated.planExpiresAt) || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de modifier le forfait" });
    }
}

// POST /api/me/boost — puts the profile at the top of Discover for 30 min.
async function boostProfile(req, res) {
    const uid = req.firebaseUser.uid;
    const now = Date.now();
    const usageRef = db.collection("usage").doc(uid);
    const profileRef = db.collection("profiles").doc(uid);
    try {
        const until = await db.runTransaction(async (tx) => {
            const [userSnap, usageSnap, profileSnap] = await Promise.all([
                tx.get(db.collection("users").doc(uid)),
                tx.get(usageRef),
                tx.get(profileRef),
            ]);
            const plan = planFor(userSnap.data(), now);
            if (!plan.boosts) {
                const err = new Error("Le Boost est inclus dans les forfaits VIP, Diamant Rouge et Jadéite Impériale.");
                err.status = 403;
                throw err;
            }
            if (toMillis(profileSnap.data()?.boostedUntil) > now) {
                const err = new Error("Un Boost est déjà en cours.");
                err.status = 409;
                throw err;
            }
            const key = periodKey(plan.boosts.period, now);
            const usage = usageSnap.data() || {};
            const count = usage.boostPeriod === key ? usage.boosts || 0 : 0;
            if (count >= plan.boosts.count) {
                const when = plan.boosts.period === "day" ? "aujourd'hui" : "cette semaine";
                const err = new Error(`Vous avez utilisé votre Boost ${when}.`);
                err.status = 429;
                throw err;
            }
            const boostedUntil = Timestamp.fromMillis(now + BOOST_DURATION_MS);
            tx.set(usageRef, { boostPeriod: key, boosts: count + 1 }, { merge: true });
            tx.set(profileRef, { boostedUntil }, { merge: true });
            return boostedUntil.toMillis();
        });
        res.json({ boostedUntil: until });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible de lancer le Boost" });
    }
}

// POST /api/me/invisible { enabled } — Jadéite Impériale only.
async function setInvisible(req, res) {
    const uid = req.firebaseUser.uid;
    const enabled = !!req.body?.enabled;
    try {
        const plan = planFor((await db.collection("users").doc(uid).get()).data());
        if (enabled && !plan.invisible) {
            return res.status(403).json({ message: "Le mode invisible est inclus dans le forfait Jadéite Impériale." });
        }
        await db.collection("profiles").doc(uid).set({ invisible: enabled }, { merge: true });
        res.json({ invisible: enabled });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de modifier le mode invisible" });
    }
}

module.exports = { setUserPlan, boostProfile, setInvisible };
