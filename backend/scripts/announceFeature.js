// Publishes an in-app announcement (shows in the "Annonces" screen and the
// bell badge) AND sends it as a real message from the official "BomaVibes"
// account into every user's inbox, so it's visible even to people who never
// check the Annonces tab.
//
// Usage:
//   node scripts/announceFeature.js "Titre" "Description du texte." ["Label du bouton" "https://lien"]
//
// Run this yourself whenever you want to announce something — it is not
// triggered automatically by code changes or deploys.

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

async function getRealUserIds(db) {
    const snap = await db.collection("profiles").get();
    return snap.docs.map((d) => d.id).filter((id) => id !== SYSTEM_ACCOUNT_ID && !id.startsWith("test-"));
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

    // createdAt should only ever be set once, on first contact.
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

async function main() {
    const [title, description, ctaLabel, ctaLink] = process.argv.slice(2);

    if (!title || !description) {
        console.error('Usage: node scripts/announceFeature.js "Titre" "Description" ["Label bouton" "URL"]');
        process.exit(1);
    }

    const db = admin.firestore();

    const doc = await db.collection("announcements").add({
        title,
        description,
        ctaLabel: ctaLabel || null,
        ctaLink: ctaLink || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Annonce publiée (id: ${doc.id}). Elle apparaît immédiatement dans l'app pour tous les utilisateurs.`);

    await ensureSystemProfile(db);
    const userIds = await getRealUserIds(db);
    const messageText = ctaLink ? `${title}\n\n${description}\n\n${ctaLabel || 'En savoir plus'} : ${ctaLink}` : `${title}\n\n${description}`;

    await Promise.all(userIds.map((uid) => sendToInbox(db, uid, messageText)));
    console.log(`Message envoyé dans la messagerie de ${userIds.length} utilisateur(s).`);

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
