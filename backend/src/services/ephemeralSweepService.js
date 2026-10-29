const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");
const { localAttachmentPath } = require("./ephemeral");

const db = admin.firestore();
const { Timestamp } = admin.firestore;

// Deletes ephemeral messages once their time is up (services/ephemeral.js),
// along with the photo, file or voice note they carried. The app already
// hides them at expiresAt; this makes them really gone.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const BATCH_SIZE = 200;
const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

async function removeAttachments(message) {
    for (const url of [message.fileUrl, message.audioUrl]) {
        const file = localAttachmentPath(url, message.senderId, UPLOADS_ROOT);
        if (file) await fs.promises.unlink(file).catch(() => {});
    }
}

async function sweepConversation(matchRef, now) {
    let deleted = 0;
    for (;;) {
        const snap = await matchRef.collection("messages").where("expiresAt", "<=", now).limit(BATCH_SIZE).get();
        if (snap.empty) break;
        const batch = db.batch();
        for (const doc of snap.docs) {
            await removeAttachments(doc.data());
            batch.delete(doc.ref);
        }
        await batch.commit();
        deleted += snap.size;
        if (snap.size < BATCH_SIZE) break;
    }
    return deleted;
}

let running = false;

async function sweepExpiredMessages() {
    if (running) return;
    running = true;
    try {
        const now = Timestamp.now();
        const matches = await db.collection("matches").where("ephemeralSweepUntil", ">=", now).get();
        let deleted = 0;
        for (const match of matches.docs) {
            deleted += await sweepConversation(match.ref, now);
        }
        if (deleted > 0) console.log(`[éphémères] ${deleted} message(s) expiré(s) supprimé(s)`);
    } catch (err) {
        console.error("[éphémères] nettoyage impossible", err);
    } finally {
        running = false;
    }
}

function startEphemeralSweepScheduler() {
    setTimeout(sweepExpiredMessages, 30 * 1000);
    setInterval(sweepExpiredMessages, SWEEP_INTERVAL_MS);
}

module.exports = { sweepExpiredMessages, startEphemeralSweepScheduler };
