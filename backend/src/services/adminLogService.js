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

async function listAdminLogs({ cursor, action } = {}) {
    let query = db.collection("admin_logs").orderBy("createdAt", "desc").limit(LOGS_LIMIT);
    if (cursor) {
        const cursorSnap = await db.collection("admin_logs").doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }
    const snap = await query.get();
    const rawLogs = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return { id: docSnap.id, ...data, createdAt: data.createdAt?.toDate?.().toISOString() ?? null };
    });

    // Filtered in memory (same trade-off as elsewhere in this codebase), so
    // a narrow action filter can come back sparse or empty on a given page.
    // hasMore/nextCursor are about the RAW page, not the filtered count —
    // otherwise pagination would wrongly stop as soon as a filtered page
    // happened to have fewer than LOGS_LIMIT matches.
    const logs = action ? rawLogs.filter((log) => log.action === action) : rawLogs;
    const hasMore = snap.docs.length === LOGS_LIMIT;
    const nextCursor = hasMore ? rawLogs[rawLogs.length - 1].id : null;

    return { logs, nextCursor };
}

module.exports = { logAdminAction, listAdminLogs };
