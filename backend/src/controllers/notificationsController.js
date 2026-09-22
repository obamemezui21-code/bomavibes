const admin = require("../config/firebaseAdmin");
const { AUDIENCES, collectAudienceTokens, sendBroadcastPush } = require("../services/notificationBroadcastService");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();

async function sendBroadcast(req, res) {
    const { title, message, audience = "all", publishAnnouncement, ctaLabel, ctaLink } = req.body;

    if (!title || typeof title !== "string" || !message || typeof message !== "string") {
        return res.status(400).json({ message: "Titre et message requis" });
    }
    if (!AUDIENCES.includes(audience)) {
        return res.status(400).json({ message: "Audience invalide" });
    }

    try {
        const tokens = await collectAudienceTokens(audience);
        const pushResult = tokens.length
            ? await sendBroadcastPush(tokens, { title, body: message, link: ctaLink || null })
            : { successCount: 0, failureCount: 0 };

        if (publishAnnouncement) {
            await db.collection("announcements").add({
                title,
                description: message,
                ctaLabel: ctaLabel || null,
                ctaLink: ctaLink || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        await logAdminAction(req, {
            action: "SEND_NOTIFICATION",
            metadata: {
                title,
                message,
                audience,
                publishAnnouncement: !!publishAnnouncement,
                pushSent: pushResult.successCount,
                pushFailed: pushResult.failureCount,
            },
        });

        res.json({ message: "Notification envoyée", pushSent: pushResult.successCount, pushFailed: pushResult.failureCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer la notification" });
    }
}

module.exports = { sendBroadcast };
