const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

// Server-originated push to one user (match found, plan activated,
// verification decided…). Respects the user's notification preference when
// one is given, drops dead device tokens, and never throws — a failed push
// must not fail the action that triggered it.
async function sendPushToUser(uid, { title, body, path = "/", prefField = null }) {
    try {
        const userRef = db.collection("users").doc(uid);
        const user = (await userRef.get()).data();
        const tokens = user?.fcmTokens || [];
        if (!tokens.length) return 0;
        if (prefField && user?.[prefField] === false) return 0;

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body },
            webpush: { fcmOptions: { link: `${FRONTEND_URL}${path}` } },
        });
        const dead = response.responses.map((r, i) => (!r.success ? tokens[i] : null)).filter(Boolean);
        if (dead.length) {
            await userRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) });
        }
        return response.successCount;
    } catch (err) {
        console.error("[push]", err);
        return 0;
    }
}

module.exports = { sendPushToUser };
