const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// "Supprimer la discussion", as on WhatsApp: the conversation is emptied and
// leaves the member's list — for them only. The other person keeps theirs
// (their copy, and what a report may need). The match stays: a new message
// brings the conversation back, from that message on.
//
// Match field, set here only (Admin SDK; firestore.rules keep it out of
// client writes): clearedAt { [uid]: timestamp }. The app hides every message
// of that member's from before it (ConversationsContext.jsx).

// POST /api/chat/:matchId/clear → { ok: true }
async function clearChat(req, res) {
    const uid = req.firebaseUser.uid;
    const { matchId } = req.params;
    if (typeof matchId !== "string" || !matchId || matchId.includes("/")) {
        return res.status(400).json({ message: "Requête invalide" });
    }
    try {
        const matchRef = db.collection("matches").doc(matchId);
        const found = await db.runTransaction(async (tx) => {
            const match = (await tx.get(matchRef)).data();
            if (!match?.users?.includes(uid)) return false;
            // Nothing left unread in a conversation one just deleted.
            tx.update(matchRef, {
                [`clearedAt.${uid}`]: FieldValue.serverTimestamp(),
                [`seen.${uid}`]: true,
            });
            return true;
        });
        if (!found) return res.status(404).json({ message: "Conversation introuvable" });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer la discussion" });
    }
}

module.exports = { clearChat };
