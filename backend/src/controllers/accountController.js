const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");

async function deleteAccount(req, res) {
  const uid = req.firebaseUser.uid;

  try {
    const matchesSnap = await db.collection("matches").where("users", "array-contains", uid).get();
    for (const matchDoc of matchesSnap.docs) {
      const messagesSnap = await matchDoc.ref.collection("messages").get();
      for (const messageDoc of messagesSnap.docs) {
        await messageDoc.ref.delete();
      }
      await matchDoc.ref.delete();
    }

    const [asSwiper, asTarget] = await Promise.all([
      db.collection("swipes").where("swiperId", "==", uid).get(),
      db.collection("swipes").where("targetId", "==", uid).get(),
    ]);
    for (const swipeDoc of [...asSwiper.docs, ...asTarget.docs]) {
      await swipeDoc.ref.delete();
    }

    await db.collection("profiles").doc(uid).delete().catch(() => {});
    await db.collection("users").doc(uid).delete().catch(() => {});

    fs.rmSync(path.join(UPLOAD_ROOT, uid), { recursive: true, force: true });

    await admin.auth().deleteUser(uid);

    res.json({ message: "Compte supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible de supprimer le compte" });
  }
}

module.exports = { deleteAccount };
