const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
// Firestore caps a single batch at 500 writes — chunk so this stays correct
// for a user with many matches/messages instead of only working by luck.
const BATCH_LIMIT = 500;

// Deletes every ref sequentially-in-chunks rather than one .delete() await
// per doc: same total writes, far fewer Firestore round-trips.
async function batchDeleteAll(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function deleteAccount(req, res) {
  const uid = req.firebaseUser.uid;

  try {
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

    // Overwritten (not merged) into a bare tombstone — every other field
    // (name, prefs, role, fcmTokens...) is dropped, so this is a real
    // erasure of that account's data. The email + timestamp survive only so
    // "Utilisateurs supprimés" in the admin CMS has something to show; the
    // Auth account itself is still fully deleted below, so the email is
    // free to sign up again immediately.
    const userSnap = await db.collection("users").doc(uid).get();
    const email = userSnap.data()?.email ?? null;
    await db.collection("users").doc(uid).set({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      email,
    });

    fs.rmSync(path.join(UPLOAD_ROOT, uid), { recursive: true, force: true });

    await admin.auth().deleteUser(uid);

    res.json({ message: "Compte supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible de supprimer le compte" });
  }
}

module.exports = { deleteAccount };
