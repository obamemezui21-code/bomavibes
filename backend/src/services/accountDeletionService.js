// Shared by the self-service DELETE /api/account (accountController.js) and
// the admin-initiated deletion in userDirectoryController.js — one place
// that knows what "an account is gone" actually means here, so both paths
// erase exactly the same things the same way.
const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
// Firestore caps a single batch at 500 writes — chunk so this stays correct
// for a user with many matches/messages instead of only working by luck.
const BATCH_LIMIT = 500;

async function batchDeleteAll(refs) {
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
            batch.delete(ref);
        }
        await batch.commit();
    }
}

// Erases matches/messages/swipes/profile/uploaded files and the Firebase
// Auth account, then replaces users/{uid} with a bare
// {deleted, deletedAt, email} tombstone (overwritten, not merged — every
// other field is dropped) so "Utilisateurs supprimés" has something to
// list. The Auth account is still fully deleted, so the email is free to
// sign up again immediately.
async function eraseAccount(uid) {
    const matchesSnap = await db.collection("matches").where("users", "array-contains", uid).get();
    const messagesSnaps = await Promise.all(
        matchesSnap.docs.map((matchDoc) => matchDoc.ref.collection("messages").get()),
    );
    const messageRefs = messagesSnaps.flatMap((snap) => snap.docs.map((doc) => doc.ref));
    await batchDeleteAll(messageRefs);
    await batchDeleteAll(matchesSnap.docs.map((doc) => doc.ref));

    const [asSwiper, asTarget] = await Promise.all([
        db.collection("swipes").where("swiperId", "==", uid).get(),
        db.collection("swipes").where("targetId", "==", uid).get(),
    ]);
    await batchDeleteAll([...asSwiper.docs, ...asTarget.docs].map((doc) => doc.ref));

    await db.collection("profiles").doc(uid).delete().catch(() => {});

    const userSnap = await db.collection("users").doc(uid).get();
    const email = userSnap.data()?.email ?? null;
    await db.collection("users").doc(uid).set({
        deleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        email,
    });

    fs.rmSync(path.join(UPLOAD_ROOT, uid), { recursive: true, force: true });

    await admin.auth().deleteUser(uid);
}

module.exports = { eraseAccount };
