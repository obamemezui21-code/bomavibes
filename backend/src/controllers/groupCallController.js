const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const admin = require("../config/firebaseAdmin");
const { effectivePlanFor } = require("../config/ngori");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Group calls (up to MAX_MEMBERS people) go through a LiveKit media server
// on the VPS instead of phone-to-phone WebRTC: each phone sends its audio /
// video once and the server forwards it to the others.
//
//   groupCalls/{id}  hostId, type, status ('active' | 'ended'),
//                    members[]  everyone invited, host included (read rule)
//                    ringing[]  invited people who haven't answered yet
//                    joined[], declined[], invitedAt{uid: ms}
//                    hostName, hostPhoto, createdAt, endedAt
//
// Every write goes through here; the app only reads (see firestore.rules).
// The LiveKit room is named after the doc id, and only members get a token.
const MAX_MEMBERS = 8;
const TOKEN_TTL = "3h";
// Someone invited who hasn't answered after this long stops ringing.
const RING_TIMEOUT_MS = 45 * 1000;
// A call nobody has been in for this long is closed by the sweep.
const EMPTY_GRACE_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

function liveKitConfig() {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;
    return {
        url: LIVEKIT_URL,
        key: LIVEKIT_API_KEY,
        secret: LIVEKIT_API_SECRET,
        // The API server, reached from this machine (no TLS needed locally).
        apiHost: process.env.LIVEKIT_API_HOST || "http://127.0.0.1:7880",
    };
}

const matchIdOf = (a, b) => [a, b].sort().join("_");

async function blockedEitherWay(a, b) {
    const [ab, ba] = await Promise.all([
        db.collection("blocks").doc(`${a}_${b}`).get(),
        db.collection("blocks").doc(`${b}_${a}`).get(),
    ]);
    return ab.exists || ba.exists;
}

// Only your own matches, never someone blocked either way.
async function checkInvitees(hostId, ids) {
    const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id && id !== hostId);
    for (const uid of unique) {
        const match = await db.collection("matches").doc(matchIdOf(hostId, uid)).get();
        if (!match.exists || (await blockedEitherWay(hostId, uid))) {
            return { error: "Vous ne pouvez inviter que vos matchs." };
        }
    }
    return { ids: unique };
}

async function canCall(uid) {
    const userSnap = await db.collection("users").doc(uid).get();
    return !!effectivePlanFor(userSnap.data()).calls;
}

async function profileOf(uid) {
    const data = (await db.collection("profiles").doc(uid).get()).data() || {};
    return { firstName: data.firstName || "", photo: data.photos?.[0] || null };
}

function ringInvitees(ids, host, type, callId) {
    const kind = type === "video" ? "vidéo" : "audio";
    for (const uid of ids) {
        sendPushToUser(uid, {
            title: `📞 ${host.firstName || "Un match"} vous invite à un appel de groupe`,
            body: `Appel ${kind} — touchez pour rejoindre.`,
            path: `/chat?groupCall=${callId}`,
            prefField: "notifyMessages",
        });
    }
}

// POST /api/group-calls { type: 'audio' | 'video', inviteeIds: [uid] }
async function createGroupCall(req, res) {
    if (!liveKitConfig()) return res.status(503).json({ message: "Les appels de groupe ne sont pas encore disponibles." });
    const hostId = req.firebaseUser.uid;
    const type = req.body?.type === "video" ? "video" : "audio";
    const inviteeIds = Array.isArray(req.body?.inviteeIds) ? req.body.inviteeIds : [];

    try {
        if (!(await canCall(hostId))) {
            return res.status(403).json({ message: "Les appels sont réservés aux abonnés." });
        }
        const checked = await checkInvitees(hostId, inviteeIds);
        if (checked.error) return res.status(400).json({ message: checked.error });
        if (checked.ids.length === 0) return res.status(400).json({ message: "Invitez au moins une personne." });
        if (checked.ids.length + 1 > MAX_MEMBERS) {
            return res.status(400).json({ message: `${MAX_MEMBERS} personnes au maximum par appel.` });
        }

        const host = await profileOf(hostId);
        const now = Date.now();
        const ref = db.collection("groupCalls").doc();
        await ref.set({
            hostId,
            type,
            status: "active",
            members: [hostId, ...checked.ids],
            ringing: checked.ids,
            joined: [],
            declined: [],
            invitedAt: Object.fromEntries(checked.ids.map((id) => [id, now])),
            hostName: host.firstName,
            hostPhoto: host.photo,
            createdAt: FieldValue.serverTimestamp(),
        });
        ringInvitees(checked.ids, host, type, ref.id);
        res.status(201).json({ callId: ref.id });
    } catch (err) {
        console.error("[group-call] create", err);
        res.status(500).json({ message: "Impossible de lancer l'appel de groupe." });
    }
}

// POST /api/group-calls/:id/invite { inviteeIds } — anyone already in the
// call can bring in their own matches, up to MAX_MEMBERS in total.
async function inviteToGroupCall(req, res) {
    const uid = req.firebaseUser.uid;
    const ref = db.collection("groupCalls").doc(req.params.id);
    try {
        const call = (await ref.get()).data();
        if (!call || call.status !== "active" || !call.members.includes(uid)) {
            return res.status(404).json({ message: "Cet appel est terminé." });
        }
        const checked = await checkInvitees(uid, req.body?.inviteeIds || []);
        if (checked.error) return res.status(400).json({ message: checked.error });
        const fresh = checked.ids.filter((id) => !call.members.includes(id) || call.declined.includes(id));
        if (fresh.length === 0) return res.json({ invited: 0 });
        const total = new Set([...call.members, ...fresh]).size;
        if (total > MAX_MEMBERS) return res.status(400).json({ message: `${MAX_MEMBERS} personnes au maximum par appel.` });

        const now = Date.now();
        await ref.update({
            members: FieldValue.arrayUnion(...fresh),
            ringing: FieldValue.arrayUnion(...fresh),
            declined: FieldValue.arrayRemove(...fresh),
            ...Object.fromEntries(fresh.map((id) => [`invitedAt.${id}`, now])),
        });
        ringInvitees(fresh, await profileOf(uid), call.type, ref.id);
        res.json({ invited: fresh.length });
    } catch (err) {
        console.error("[group-call] invite", err);
        res.status(500).json({ message: "Impossible d'inviter cette personne." });
    }
}

// POST /api/group-calls/:id/join → { url, token } for the LiveKit room.
async function joinGroupCall(req, res) {
    const config = liveKitConfig();
    if (!config) return res.status(503).json({ message: "Les appels de groupe ne sont pas encore disponibles." });
    const uid = req.firebaseUser.uid;
    const ref = db.collection("groupCalls").doc(req.params.id);
    try {
        const call = (await ref.get()).data();
        if (!call || call.status !== "active" || !call.members.includes(uid)) {
            return res.status(404).json({ message: "Cet appel est terminé." });
        }
        if (await blockedEitherWay(uid, call.hostId)) return res.status(403).json({ message: "Accès refusé." });

        const me = await profileOf(uid);
        const token = new AccessToken(config.key, config.secret, {
            identity: uid,
            name: me.firstName,
            metadata: JSON.stringify({ photo: me.photo }),
            ttl: TOKEN_TTL,
        });
        token.addGrant({ roomJoin: true, room: ref.id, canPublish: true, canSubscribe: true, canPublishData: true });

        await ref.update({
            ringing: FieldValue.arrayRemove(uid),
            declined: FieldValue.arrayRemove(uid),
            joined: FieldValue.arrayUnion(uid),
            lastJoinAt: Date.now(),
        });
        res.json({ url: config.url, token: await token.toJwt() });
    } catch (err) {
        console.error("[group-call] join", err);
        res.status(500).json({ message: "Impossible de rejoindre l'appel." });
    }
}

// POST /api/group-calls/:id/decline
async function declineGroupCall(req, res) {
    const uid = req.firebaseUser.uid;
    const ref = db.collection("groupCalls").doc(req.params.id);
    try {
        const call = (await ref.get()).data();
        if (call?.members?.includes(uid)) {
            await ref.update({ ringing: FieldValue.arrayRemove(uid), declined: FieldValue.arrayUnion(uid) });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error("[group-call] decline", err);
        res.status(500).json({ message: "Erreur" });
    }
}

async function participantsIn(roomName) {
    const config = liveKitConfig();
    const rooms = new RoomServiceClient(config.apiHost, config.key, config.secret);
    try {
        return await rooms.listParticipants(roomName);
    } catch {
        return []; // the room is gone: nobody's in it
    }
}

async function endCall(ref) {
    await ref.update({ status: "ended", ringing: [], endedAt: FieldValue.serverTimestamp() });
}

// POST /api/group-calls/:id/leave — the last one out closes the call.
async function leaveGroupCall(req, res) {
    const uid = req.firebaseUser.uid;
    const ref = db.collection("groupCalls").doc(req.params.id);
    try {
        const call = (await ref.get()).data();
        if (call?.status === "active" && call.members.includes(uid) && liveKitConfig()) {
            const others = (await participantsIn(ref.id)).filter((p) => p.identity !== uid);
            if (others.length === 0) await endCall(ref);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error("[group-call] leave", err);
        res.status(500).json({ message: "Erreur" });
    }
}

// Closes calls left empty (everyone dropped without "leave": closed tab,
// lost network) and stops the ringing of invitations nobody answered.
async function sweepGroupCalls() {
    if (!liveKitConfig()) return;
    try {
        const snap = await db.collection("groupCalls").where("status", "==", "active").get();
        const now = Date.now();
        for (const doc of snap.docs) {
            const call = doc.data();
            const expired = (call.ringing || []).filter((id) => now - (call.invitedAt?.[id] || 0) > RING_TIMEOUT_MS);
            if (expired.length) await doc.ref.update({ ringing: FieldValue.arrayRemove(...expired) });

            const since = Math.max(call.createdAt?.toMillis?.() || 0, call.lastJoinAt || 0);
            if (now - since < EMPTY_GRACE_MS) continue;
            if ((await participantsIn(doc.id)).length === 0) await endCall(doc.ref);
        }
    } catch (err) {
        console.error("[group-call] sweep", err);
    }
}

function startGroupCallSweep() {
    setInterval(sweepGroupCalls, SWEEP_INTERVAL_MS);
}

module.exports = {
    MAX_MEMBERS,
    createGroupCall,
    declineGroupCall,
    inviteToGroupCall,
    joinGroupCall,
    leaveGroupCall,
    startGroupCallSweep,
};
