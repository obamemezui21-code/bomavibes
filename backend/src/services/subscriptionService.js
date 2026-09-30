const admin = require("../config/firebaseAdmin");
const { PLANS, activePlanId, toMillis } = require("../config/plans");
const { sendPushToUser } = require("./pushService");

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const DAY_MS = 24 * 60 * 60 * 1000;

// Gives `uid` the paid `plan` for `days` more days. Renewing the same plan
// extends it from its current end date; any other change starts from today.
// Shared by manual admin activation and online payments. Returns the new
// expiry (ms).
async function grantPlan(uid, plan, days, updatedBy) {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        const err = new Error("Utilisateur introuvable");
        err.status = 404;
        throw err;
    }

    const now = Date.now();
    const current = userSnap.data();
    const from = activePlanId(current, now) === plan ? Math.max(now, toMillis(current.planExpiresAt)) : now;
    const expiresAt = Timestamp.fromMillis(from + days * DAY_MS);

    const batch = db.batch();
    batch.update(userRef, {
        plan,
        planExpiresAt: expiresAt,
        planUpdatedAt: FieldValue.serverTimestamp(),
        planUpdatedBy: updatedBy,
    });
    // Public, read by everyone's Discover ranking.
    batch.set(
        db.collection("profiles").doc(uid),
        { visibility: PLANS[plan].visibility, visibilityUntil: expiresAt, ...(PLANS[plan].invisible ? {} : { invisible: false }) },
        { merge: true },
    );
    await batch.commit();

    const until = new Date(expiresAt.toMillis()).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    sendPushToUser(uid, {
        title: `Forfait ${PLANS[plan].label} activé 🎉`,
        body: `Profitez de vos avantages jusqu'au ${until}.`,
        path: "/profile",
    });
    return expiresAt.toMillis();
}

module.exports = { grantPlan };
