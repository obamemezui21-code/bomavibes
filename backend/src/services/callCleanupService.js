const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// Call docs (calls/{id} + their ICE candidate subcollections) are only
// needed while a call is set up and running; afterwards they're dead
// weight holding SDP/candidate data. Clear out anything older than this.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

async function cleanupOldCalls() {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - MAX_AGE_MS);
    let deleted = 0;
    try {
        // Batches until nothing old is left, so a backlog clears in one run.
        for (;;) {
            const snap = await db.collection("calls").where("createdAt", "<", cutoff).limit(BATCH_SIZE).get();
            if (snap.empty) break;
            // recursiveDelete also removes the callerCandidates /
            // calleeCandidates subcollections, which a plain delete leaves behind.
            await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
            deleted += snap.size;
            if (snap.size < BATCH_SIZE) break;
        }
        if (deleted > 0) console.log(`[calls] ${deleted} ancien(s) appel(s) supprimé(s)`);
    } catch (err) {
        console.error("[calls] nettoyage impossible", err);
    }
}

function startCallCleanupScheduler() {
    cleanupOldCalls();
    setInterval(cleanupOldCalls, CLEANUP_INTERVAL_MS);
}

module.exports = { cleanupOldCalls, startCallCleanupScheduler };
