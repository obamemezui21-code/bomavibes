const admin = require("../config/firebaseAdmin");
const { isValidTtl, sweepUntilMs } = require("../services/ephemeral");

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

// Set here only (Admin SDK): firestore.rules keep `ephemeral` and
// `ephemeralSweepUntil` out of client writes, and make every message sent
// while it's on carry an expiresAt within the chosen duration.
// Match fields: ephemeral { ttl (s), by, at }, ephemeralSweepUntil.
// A notice (type "ephemeral") tells both members in the conversation.

// POST /api/chat/:matchId/ephemeral { ttl } → { ttl }
async function setEphemeral(req, res) {
    const uid = req.firebaseUser.uid;
    const { matchId } = req.params;
    const ttl = req.body?.ttl;
    if (typeof matchId !== "string" || !matchId || matchId.includes("/") || !isValidTtl(ttl)) {
        return res.status(400).json({ message: "Requête invalide" });
    }
    try {
        const matchRef = db.collection("matches").doc(matchId);
        const result = await db.runTransaction(async (tx) => {
            const match = (await tx.get(matchRef)).data();
            if (!match?.users?.includes(uid)) return null;
            const previousTtl = match.ephemeral?.ttl || 0;
            if (previousTtl === ttl) return { ttl };

            const update = { ephemeral: { ttl, by: uid, at: FieldValue.serverTimestamp() } };
            const until = sweepUntilMs(ttl, previousTtl, Date.now());
            if (until) update.ephemeralSweepUntil = Timestamp.fromMillis(until);
            tx.update(matchRef, update);
            tx.create(matchRef.collection("messages").doc(), {
                senderId: uid,
                type: "ephemeral",
                text: "",
                ttl,
                createdAt: FieldValue.serverTimestamp(),
            });
            return { ttl };
        });
        if (!result) return res.status(404).json({ message: "Conversation introuvable" });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { setEphemeral };
