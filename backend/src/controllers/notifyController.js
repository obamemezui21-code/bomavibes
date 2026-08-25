const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// activeIn.{uid} is a heartbeated timestamp (see the effect in
// ConversationsContext.jsx keyed on openMatchId), not a sticky flag — a
// crashed or force-closed tab stops refreshing it, so it naturally goes
// stale here instead of permanently suppressing that user's notifications.
const ACTIVE_IN_THRESHOLD_MS = 45 * 1000;

function isRecentTimestamp(ts) {
  const ms = ts?.toMillis?.();
  return !!ms && Date.now() - ms < ACTIVE_IN_THRESHOLD_MS;
}

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
  post_like: {
    prefField: "notifyFeed",
    build: (payload) => ({
      title: payload?.firstName ? `${payload.firstName} a aimé votre publication` : "Nouveau j'aime",
      body: payload?.preview || "Quelqu'un a aimé votre publication.",
    }),
  },
  post_comment: {
    prefField: "notifyFeed",
    build: (payload) => ({
      title: payload?.firstName ? `${payload.firstName} a commenté votre publication` : "Nouveau commentaire",
      body: payload?.text || "Vous avez reçu un nouveau commentaire.",
    }),
  },
  comment_reply: {
    prefField: "notifyFeed",
    build: (payload) => ({
      title: payload?.firstName ? `${payload.firstName} a répondu à votre commentaire` : "Nouvelle réponse",
      body: payload?.text || "Vous avez reçu une réponse à votre commentaire.",
    }),
  },
};

async function notify(req, res) {
  const { targetUid, type, payload } = req.body;
  const config = NOTIFICATIONS[type];
  const senderId = req.firebaseUser.uid;

  if (!targetUid || !config) {
    return res.status(400).json({ message: "Requête de notification invalide" });
  }

  try {
    // A new chat message shouldn't push if the recipient already has that
    // exact conversation open — they're watching it arrive live.
    if (type === "message" && payload?.matchId) {
      const matchSnap = await db.collection("matches").doc(payload.matchId).get();
      if (isRecentTimestamp(matchSnap.data()?.activeIn?.[targetUid])) {
        return res.json({ sent: 0, skipped: "recipient_active_in_conversation" });
      }
    }

    const targetSnap = await db.collection("users").doc(targetUid).get();
    const target = targetSnap.data();
    const tokens = target?.fcmTokens || [];
    const prefEnabled = target?.[config.prefField] ?? true;

    if (!prefEnabled || tokens.length === 0) {
      return res.json({ sent: 0 });
    }

    const { title, body } = config.build(payload);
    const message = {
      tokens,
      notification: { title, body },
    };

    // Lets the app open the exact conversation from the notification: data
    // for a custom click handler (see notificationclick in
    // firebase-messaging-sw.js), fcmOptions.link as a built-in fallback if
    // that handler is ever removed.
    if (type === "message" && payload?.matchId) {
      message.data = {
        type: "chat_message",
        conversationId: String(payload.matchId),
        senderId: String(senderId),
        messageId: String(payload.messageId || ""),
      };
      message.webpush = {
        fcmOptions: { link: `${process.env.FRONTEND_URL || "https://bomavibes.tech"}/chat/${payload.matchId}` },
      };
    }

    const response = await admin.messaging().sendEachForMulticast(message);

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
