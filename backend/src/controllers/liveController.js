const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const admin = require("../config/firebaseAdmin");
const { liveKitConfig } = require("./groupCallController");
const { isVerified, VERIFIED_ONLY_MESSAGE } = require("../services/identityAccess");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Lives: one member films, everyone else watches, comments and sends hearts.
// Same LiveKit media server as group calls (deployment/livekit-setup.md).
// Anyone verified can go live; moderation can cut a live at any time.
//
// Firestore (Admin SDK only, read by signed-in members):
//   lives/{id}             hostId, hostName, hostPhoto, title, status
//                          ('live' | 'ended'), createdAt, endedAt, endedBy,
//                          lastHostSeenAt (ms), viewers (approx.), peakViewers
//   lives/{id}/comments    authorId, authorName, authorPhoto, text, createdAt
// Hearts travel as LiveKit data messages only (nothing stored).

const TITLE_MAX = 80;
const COMMENT_MAX = 200;
const COMMENT_EVERY_MS = 2000;
const TOKEN_TTL = "4h";
// A live whose host is gone from the room this long is closed by the sweep.
const HOST_GONE_MS = 2 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const NOTIFY_MAX = 300;

const UNAVAILABLE = "Les lives ne sont pas encore disponibles.";

class LiveError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof LiveError) return res.status(err.status).json({ message: err.message });
    console.error("[live]", err);
    res.status(500).json({ message: fallback });
}

function rooms(config) {
    return new RoomServiceClient(config.apiHost, config.key, config.secret);
}

async function profileOf(uid) {
    const data = (await db.collection("profiles").doc(uid).get()).data() || {};
    return { firstName: data.firstName || "", photo: data.photos?.[0] || null };
}

async function blockedEitherWay(a, b) {
    const [ab, ba] = await Promise.all([
        db.collection("blocks").doc(`${a}_${b}`).get(),
        db.collection("blocks").doc(`${b}_${a}`).get(),
    ]);
    return ab.exists || ba.exists;
}

async function loadLive(id) {
    if (typeof id !== "string" || !id || id.includes("/")) throw new LiveError(404, "Ce live est terminé.");
    const ref = db.collection("lives").doc(id);
    const live = (await ref.get()).data();
    if (!live || live.status !== "live") throw new LiveError(404, "Ce live est terminé.");
    return { ref, live };
}

// "🔴 X est en live" to the host's matches (not to everyone: that would be spam).
async function notifyMatches(hostId, host, liveId) {
    const snap = await db.collection("matches").where("users", "array-contains", hostId).limit(NOTIFY_MAX).get();
    for (const doc of snap.docs) {
        const other = doc.data().users.find((u) => u !== hostId);
        if (!other) continue;
        sendPushToUser(other, {
            title: `🔴 ${host.firstName || "Un de vos matchs"} est en live`,
            body: "Venez regarder et commenter !",
            path: `/lives/${liveId}`,
            prefField: "notifyMatches",
        }).catch(() => {});
    }
}

// GET /api/lives/status → { available }
function liveStatus(req, res) {
    res.json({ available: !!liveKitConfig() });
}

// POST /api/lives { title } → { liveId }
async function startLive(req, res) {
    if (!liveKitConfig()) return res.status(503).json({ message: UNAVAILABLE });
    const uid = req.firebaseUser.uid;
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, TITLE_MAX) : "";
    try {
        if (!(await isVerified(uid))) return res.status(403).json({ message: VERIFIED_ONLY_MESSAGE, code: "verified_only" });
        // One live at a time: an older one still open is closed first.
        // (single-field query + filter here: no composite index needed)
        const mine = await db.collection("lives").where("hostId", "==", uid).get();
        await Promise.all(mine.docs.filter((d) => d.data().status === "live").map((d) => endLiveDoc(d.ref, uid)));

        const host = await profileOf(uid);
        const ref = db.collection("lives").doc();
        await ref.set({
            hostId: uid,
            hostName: host.firstName,
            hostPhoto: host.photo,
            title: title || null,
            status: "live",
            viewers: 0,
            peakViewers: 0,
            lastHostSeenAt: Date.now(),
            createdAt: FieldValue.serverTimestamp(),
        });
        notifyMatches(uid, host, ref.id).catch((err) => console.error("[live] notify", err.message));
        res.status(201).json({ liveId: ref.id });
    } catch (err) {
        sendError(res, err, "Impossible de lancer le live.");
    }
}

// POST /api/lives/:id/join → { url, token, isHost }
async function joinLive(req, res) {
    const config = liveKitConfig();
    if (!config) return res.status(503).json({ message: UNAVAILABLE });
    const uid = req.firebaseUser.uid;
    try {
        const { ref, live } = await loadLive(req.params.id);
        const isHost = live.hostId === uid;
        if (!isHost && (await blockedEitherWay(uid, live.hostId))) throw new LiveError(404, "Ce live est terminé.");

        const me = await profileOf(uid);
        const token = new AccessToken(config.key, config.secret, {
            identity: uid,
            name: me.firstName,
            metadata: JSON.stringify({ photo: me.photo }),
            ttl: TOKEN_TTL,
        });
        // Only the host sends audio / video; everyone can send hearts (data).
        token.addGrant({ roomJoin: true, room: `live-${ref.id}`, canPublish: isHost, canSubscribe: true, canPublishData: true });
        if (isHost) await ref.update({ lastHostSeenAt: Date.now() });
        res.json({ url: config.url, token: await token.toJwt(), isHost });
    } catch (err) {
        sendError(res, err, "Impossible de rejoindre le live.");
    }
}

async function endLiveDoc(ref, by) {
    await ref.update({ status: "ended", endedAt: FieldValue.serverTimestamp(), endedBy: by });
    const config = liveKitConfig();
    if (config) await rooms(config).deleteRoom(`live-${ref.id}`).catch(() => {});
}

// POST /api/lives/:id/end — the host stops their live.
async function endLive(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const { ref, live } = await loadLive(req.params.id);
        if (live.hostId !== uid) throw new LiveError(403, "Seule la personne en live peut l'arrêter.");
        await endLiveDoc(ref, uid);
        res.json({ ok: true });
    } catch (err) {
        if (err instanceof LiveError && err.status === 404) return res.json({ ok: true });
        sendError(res, err, "Impossible d'arrêter le live.");
    }
}

// POST /api/admin/lives/:id/end — moderation cuts a live.
async function cutLive(req, res) {
    try {
        const { ref } = await loadLive(req.params.id);
        await endLiveDoc(ref, "moderation");
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, "Impossible de couper le live.");
    }
}

const lastCommentAt = new Map();

// POST /api/lives/:id/comments { text }
async function commentLive(req, res) {
    const uid = req.firebaseUser.uid;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > COMMENT_MAX) return res.status(400).json({ message: "Commentaire invalide." });
    const now = Date.now();
    if (now - (lastCommentAt.get(uid) || 0) < COMMENT_EVERY_MS) {
        return res.status(429).json({ message: "Doucement, un commentaire toutes les 2 secondes." });
    }
    try {
        const { ref, live } = await loadLive(req.params.id);
        if (live.hostId !== uid && (await blockedEitherWay(uid, live.hostId))) throw new LiveError(404, "Ce live est terminé.");
        lastCommentAt.set(uid, now);
        const me = await profileOf(uid);
        await ref.collection("comments").add({
            authorId: uid,
            authorName: me.firstName,
            authorPhoto: me.photo,
            text,
            createdAt: FieldValue.serverTimestamp(),
        });
        res.status(201).json({ ok: true });
    } catch (err) {
        sendError(res, err, "Impossible d'envoyer le commentaire.");
    }
}

// Keeps viewer counts fresh and closes lives whose host left without "end"
// (closed tab, lost network).
async function sweepLives() {
    const config = liveKitConfig();
    if (!config) return;
    try {
        const snap = await db.collection("lives").where("status", "==", "live").get();
        const now = Date.now();
        for (const doc of snap.docs) {
            const live = doc.data();
            const people = await rooms(config)
                .listParticipants(`live-${doc.id}`)
                .catch(() => []);
            const hostHere = people.some((p) => p.identity === live.hostId);
            if (hostHere) {
                const viewers = people.length - 1;
                await doc.ref.update({ lastHostSeenAt: now, viewers, peakViewers: Math.max(live.peakViewers || 0, viewers) });
            } else if (now - (live.lastHostSeenAt || 0) > HOST_GONE_MS) {
                await endLiveDoc(doc.ref, "timeout");
            }
        }
    } catch (err) {
        console.error("[live] sweep", err);
    }
}

function startLiveSweep() {
    setInterval(sweepLives, SWEEP_INTERVAL_MS);
}

module.exports = { liveStatus, startLive, joinLive, endLive, cutLive, commentLive, startLiveSweep };
