const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const LOGS_LIMIT = 200;

// Best-effort audit trail for every admin mutation (ban, role change,
// content edit, etc.) — a logging failure must never block the action it
// describes, so this only ever logs to the console, never throws. Never
// touched by client SDKs (see firestore.rules: admin_logs is write:false),
// so this is the only way a row is ever created.
async function logAdminAction(req, { action, targetType = null, targetId = null, metadata = null, result = "SUCCESS" }) {
    try {
        await db.collection("admin_logs").add({
            adminUid: req.firebaseUser.uid,
            adminEmail: req.firebaseUser.email || null,
            action,
            targetType,
            targetId,
            metadata,
            result,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error("Échec de l'écriture du journal d'activité admin:", err);
    }
}

async function listAdminLogs({ cursor } = {}) {
    let query = db.collection("admin_logs").orderBy("createdAt", "desc").limit(LOGS_LIMIT);
    if (cursor) {
        const cursorSnap = await db.collection("admin_logs").doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }
    const snap = await query.get();
    return snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return { id: docSnap.id, ...data, createdAt: data.createdAt?.toDate?.().toISOString() ?? null };
    });
}

module.exports = { logAdminAction, listAdminLogs };
