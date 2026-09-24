// Notifies one or more SPECIFIC accounts by email — unlike
// announceFeature.js/broadcastAnnouncement.js, which always reach every
// user. Sends both a push notification (if the account has a registered
// device) and a message from the official "BomaVibes" account into their
// inbox (reusing the exact same system-account trick as
// announceFeature.js), so it's visible even if push isn't enabled.
//
// Usage:
//   node scripts/notifyUser.js "Titre" "Message" email1[,email2,...]

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

const SYSTEM_ACCOUNT_ID = "bomavibes-team";
const SYSTEM_LOGO_URL = "https://bomavibes.tech/bomavibes-logo.jpeg";

async function ensureSystemProfile(db) {
    await db.collection("profiles").doc(SYSTEM_ACCOUNT_ID).set(
        {
            firstName: "BomaVibes",
            bio: "Annonces officielles de l'équipe BomaVibes.",
            photos: [SYSTEM_LOGO_URL],
            verified: true,
            isSystemAccount: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
}

async function sendToInbox(db, uid, messageText) {
    const matchId = [uid, SYSTEM_ACCOUNT_ID].sort().join("_");
    const matchRef = db.collection("matches").doc(matchId);

    await matchRef.set(
        {
            users: [uid, SYSTEM_ACCOUNT_ID].sort(),
            lastMessage: messageText,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            [`seen.${uid}`]: false,
            [`seen.${SYSTEM_ACCOUNT_ID}`]: true,
        },
        { merge: true },
    );

    const existing = await matchRef.get();
    if (!existing.data()?.createdAt) {
        await matchRef.set({ createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    await matchRef.collection("messages").add({
        senderId: SYSTEM_ACCOUNT_ID,
        text: messageText,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function sendPush(db, uid, title, body) {
    const snap = await db.collection("users").doc(uid).get();
    const tokens = snap.data()?.fcmTokens || [];
    if (tokens.length === 0) return 0;
    const response = await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
    return response.successCount;
}

async function main() {
    const [title, description, emailsArg] = process.argv.slice(2);

    if (!title || !description || !emailsArg) {
        console.error('Usage: node scripts/notifyUser.js "Titre" "Message" email1[,email2,...]');
        process.exit(1);
    }

    const db = admin.firestore();
    await ensureSystemProfile(db);

    const emails = emailsArg.split(",").map((e) => e.trim()).filter(Boolean);
    for (const email of emails) {
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            await sendToInbox(db, userRecord.uid, `${title}\n\n${description}`);
            const pushCount = await sendPush(db, userRecord.uid, title, description);
            console.log(`${email} → message envoyé dans la messagerie, push: ${pushCount} appareil(s)`);
        } catch (err) {
            console.error(`Échec pour ${email}:`, err.message);
        }
    }

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
