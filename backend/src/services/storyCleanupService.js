const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// Stories show for 24 h (the app's window query), but nothing removed them
// afterwards: the doc, its reactions/comments and above all the uploaded
// video (up to 25 MB) stayed forever and slowly filled the VPS disk. Clear
// out every story a little past its lifetime.
const MAX_AGE_MS = 26 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 3 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");
// Story media live in uploads/stories/{uid}/ (videos + posters) or
// uploads/feed-posts/{uid}/ (photos, shared upload route with the feed).
const MEDIA_DIRS = ["stories", "feed-posts"];
const MEDIA_FILE = /^(video|photo)-\d+(-thumb|-poster)?\.(jpg|jpeg|png|webp|mp4|mov|webm)$/;

// The URLs come from the story doc, which the app wrote: only ever delete a
// file that is one of the story author's own uploads in a media folder,
// whatever the URL says (no "../", no other user's folder, no profile photo).
function localMediaPath(url, authorId) {
    if (typeof url !== "string" || !url) return null;
    let pathname;
    try {
        pathname = new URL(url, "https://bomavibes.tech").pathname;
    } catch {
        return null;
    }
    const parts = decodeURIComponent(pathname).split("/").filter(Boolean);
    if (parts.length !== 4 || parts[0] !== "uploads") return null;
    const [, dir, uid, file] = parts;
    if (!MEDIA_DIRS.includes(dir) || uid !== authorId || !MEDIA_FILE.test(file)) return null;
    const full = path.resolve(UPLOADS_ROOT, dir, uid, file);
    return full.startsWith(UPLOADS_ROOT + path.sep) ? full : null;
}

// A story photo is uploaded through the feed's route: keep it if a post
// happens to use the very same file.
async function usedByAPost(url) {
    const snap = await db.collection("posts").where("photoUrl", "==", url).limit(1).get();
    return !snap.empty;
}

async function removeStoryMedia(story) {
    const urls = [story.videoUrl, story.photoUrl, story.photoThumbUrl].filter(Boolean);
    for (const url of urls) {
        const file = localMediaPath(url, story.authorId);
        if (!file) continue;
        if (file.includes(`${path.sep}feed-posts${path.sep}`) && (await usedByAPost(url))) continue;
        await fs.promises.unlink(file).catch(() => {});
    }
}

async function cleanupExpiredStories() {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - MAX_AGE_MS);
    let deleted = 0;
    try {
        for (;;) {
            const snap = await db.collection("stories").where("createdAt", "<", cutoff).limit(BATCH_SIZE).get();
            if (snap.empty) break;
            for (const doc of snap.docs) {
                await removeStoryMedia(doc.data());
                // recursiveDelete also removes the reactions / comments subcollections.
                await db.recursiveDelete(doc.ref);
            }
            deleted += snap.size;
            if (snap.size < BATCH_SIZE) break;
        }
        if (deleted > 0) console.log(`[stories] ${deleted} statut(s) expiré(s) supprimé(s)`);
    } catch (err) {
        console.error("[stories] nettoyage impossible", err);
    }
}

function startStoryCleanupScheduler() {
    cleanupExpiredStories();
    setInterval(cleanupExpiredStories, CLEANUP_INTERVAL_MS);
}

module.exports = { cleanupExpiredStories, localMediaPath, startStoryCleanupScheduler };
