const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

const NOTIFICATIONS = {
  match: {
    prefField: "notifyMatches",
    build: (payload) => ({
      title: "Nouveau match !",
      body: payload?.firstName ? `Vous et ${payload.firstName} vous êtes plu mutuellement.` : "Vous avez un nouveau match.",
    }),
  },
  message: {
    prefField: "notifyMessages",
    build: (payload) => ({
      title: payload?.firstName ? `${payload.firstName}` : "Nouveau message",
      body: payload?.text || "Vous avez reçu un nouveau message.",
    }),
  },
};

async function notify(req, res) {
  const { targetUid, type, payload } = req.body;
  const config = NOTIFICATIONS[type];

  if (!targetUid || !config) {
    return res.status(400).json({ message: "Requête de notification invalide" });
  }

  try {
    const targetSnap = await db.collection("users").doc(targetUid).get();
    const target = targetSnap.data();
    const tokens = target?.fcmTokens || [];
    const prefEnabled = target?.[config.prefField] ?? true;

    if (!prefEnabled || tokens.length === 0) {
      return res.json({ sent: 0 });
    }

    const { title, body } = config.build(payload);
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    const deadTokens = response.responses
      .map((r, i) => (!r.success ? tokens[i] : null))
      .filter(Boolean);
    if (deadTokens.length > 0) {
      await db.collection("users").doc(targetUid).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens),
      });
    }

    res.json({ sent: response.successCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible d'envoyer la notification" });
  }
}

module.exports = { notify };
