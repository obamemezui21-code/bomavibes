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
  call: {
    prefField: "notifyMessages",
    build: (payload) => ({
      title: `${payload?.callType === "video" ? "Appel vidéo" : "Appel audio"}${payload?.firstName ? ` de ${payload.firstName}` : ""}`,
      body: "Touchez pour répondre.",
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

async function hasCommentBy(postId, uid) {
  const snap = await db.collection("posts").doc(postId).collection("comments")
    .where("authorId", "==", uid).limit(1).get();
  return !snap.empty;
}

// The client asks for a push, but the server decides whether the sender is
// actually allowed to notify this person: without this any signed-in user
// could push "new message / match / call" notifications to anyone.
// Returns the match doc data for match-based types (reused below).
async function checkRelationship(type, senderId, targetUid, payload) {
  if (senderId === targetUid) return { ok: false };

  if (type === "message" || type === "call") {
    if (typeof payload?.matchId !== "string" || !payload.matchId) return { ok: false };
    const matchSnap = await db.collection("matches").doc(payload.matchId).get();
    const users = matchSnap.data()?.users || [];
    return { ok: users.includes(senderId) && users.includes(targetUid), match: matchSnap.data() };
  }

  if (type === "match") {
    const matchId = [senderId, targetUid].sort().join("_");
    const matchSnap = await db.collection("matches").doc(matchId).get();
    return { ok: matchSnap.exists };
  }

  if (typeof payload?.postId !== "string" || !payload.postId) return { ok: false };
  const postSnap = await db.collection("posts").doc(payload.postId).get();
  if (!postSnap.exists) return { ok: false };
  const authorId = postSnap.data().authorId;

  if (type === "post_like") {
    const likeSnap = await postSnap.ref.collection("likes").doc(senderId).get();
    return { ok: authorId === targetUid && likeSnap.exists };
  }
  if (type === "post_comment") {
    return { ok: authorId === targetUid && (await hasCommentBy(payload.postId, senderId)) };
  }
  if (type === "comment_reply") {
    const [targetCommented, senderCommented] = await Promise.all([
      hasCommentBy(payload.postId, targetUid),
      hasCommentBy(payload.postId, senderId),
    ]);
    return { ok: targetCommented && senderCommented };
  }
  return { ok: false };
}

async function notify(req, res) {
  const { targetUid, type } = req.body;
  const config = NOTIFICATIONS[type];
  const senderId = req.firebaseUser.uid;

  if (typeof targetUid !== "string" || !targetUid || !config) {
    return res.status(400).json({ message: "Requête de notification invalide" });
  }

  try {
    const relationship = await checkRelationship(type, senderId, targetUid, req.body.payload);
    if (!relationship.ok) {
      return res.status(403).json({ message: "Notification non autorisée" });
    }

    // Someone who blocked the sender never hears from them.
    const blockSnap = await db.collection("blocks").doc(`${targetUid}_${senderId}`).get();
    if (blockSnap.exists) {
      return res.json({ sent: 0, skipped: "blocked" });
    }

    // The name shown in the notification comes from the sender's real
    // profile, not from whatever the client sent.
    const senderProfile = await db.collection("profiles").doc(senderId).get();
    const payload = { ...req.body.payload, firstName: senderProfile.data()?.firstName || "" };

    // A new chat message shouldn't push if the recipient already has that
    // exact conversation open — they're watching it arrive live.
    if (type === "message" && isRecentTimestamp(relationship.match?.activeIn?.[targetUid])) {
      return res.json({ sent: 0, skipped: "recipient_active_in_conversation" });
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

    // Incoming call: opening the notification lands on the conversation,
    // where the app picks up the still-ringing call and shows it.
    if (type === "call" && payload?.matchId) {
      message.data = {
        type: "call",
        conversationId: String(payload.matchId),
        callId: String(payload.callId || ""),
        senderId: String(senderId),
      };
      message.webpush = {
        headers: { Urgency: "high", TTL: "45" },
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
