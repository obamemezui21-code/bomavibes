const path = require("path");

// Ephemeral messages: a conversation setting either member can turn on.
// While it's on, every new message carries an expiresAt, and the sweeper
// (ephemeralSweepService.js) deletes it — with its photo / file / voice
// note — once that time has passed.

const HOUR_S = 60 * 60;
// Off, 24 hours, 7 days (lib/ephemeral.js in the app has the same list).
const EPHEMERAL_TTLS = [0, 24 * HOUR_S, 7 * 24 * HOUR_S];
// "Keep sweeping this conversation" while the setting is on.
const FOREVER_MS = 10 * 365 * 24 * HOUR_S * 1000;

function isValidTtl(ttl) {
    return EPHEMERAL_TTLS.includes(ttl);
}

// Until when the sweeper must look at a conversation (match field
// ephemeralSweepUntil, in ms), or null to leave it as it is. Turned off,
// the messages sent just before still expire up to one ttl later.
function sweepUntilMs(ttl, previousTtl, now) {
    if (ttl > 0) return now + FOREVER_MS;
    if (previousTtl > 0) return now + previousTtl * 1000 + HOUR_S * 1000;
    return null;
}

// Uploads a message may point at: only ever delete one of the sender's own
// files in a chat folder, whatever the URL says (no "../", no other
// member's folder, no profile photo).
const ATTACHMENT_DIRS = {
    "chat-attachments": /^(image|file)-\d+[-\w.]*$/,
    "voice-notes": /^voice-\d+\.webm$/,
};

function localAttachmentPath(url, senderId, uploadsRoot) {
    if (typeof url !== "string" || !url || typeof senderId !== "string" || !senderId) return null;
    let pathname;
    try {
        pathname = new URL(url, "https://bomavibes.tech").pathname;
    } catch {
        return null;
    }
    let parts;
    try {
        parts = decodeURIComponent(pathname).split("/").filter(Boolean);
    } catch {
        return null;
    }
    if (parts.length !== 4 || parts[0] !== "uploads") return null;
    const [, dir, uid, file] = parts;
    if (!ATTACHMENT_DIRS[dir] || uid !== senderId || !ATTACHMENT_DIRS[dir].test(file) || file.includes("..")) return null;
    const root = path.resolve(uploadsRoot);
    const full = path.resolve(root, dir, uid, file);
    return full.startsWith(root + path.sep) ? full : null;
}

module.exports = { EPHEMERAL_TTLS, isValidTtl, sweepUntilMs, localAttachmentPath };
