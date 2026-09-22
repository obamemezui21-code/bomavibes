// Bulk-send behind the admin Notifications page. Distinct from
// notifyController.js, which pushes a single transactional notification
// (new match/message/like) to one user — this fans a campaign out to
// however many devices match an audience.
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const INACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const USERS_PAGE_SIZE = 500;
const FCM_BATCH_SIZE = 500; // sendEachForMulticast's own hard cap per call

const AUDIENCES = ["all", "verified", "new", "inactive"];

function matchesAudience(audience, { verified, createdAtMs, lastActiveMs, now }) {
    if (audience === "verified") return verified;
    if (audience === "new") return !!createdAtMs && now - createdAtMs < NEW_USER_WINDOW_MS;
    if (audience === "inactive") return !lastActiveMs || now - lastActiveMs > INACTIVE_WINDOW_MS;
    return true; // 'all'
}

// Walks the whole users collection page by page (not capped like the
// browsing-oriented directory list — under-reaching part of the real user
// base on a real campaign would be a functional bug, not just a UX
// shortcut), joining each page against profiles for verified/lastActive.
async function collectAudienceTokens(audience) {
    const now = Date.now();
    const tokens = [];
    let lastDoc = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        let query = db.collection("users").orderBy("__name__").limit(USERS_PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);
        const snap = await query.get();
        if (snap.empty) break;

        const eligible = snap.docs.filter((docSnap) => {
            const data = docSnap.data();
            return !data.deleted && !data.banned && (data.fcmTokens || []).length > 0;
        });

        const uids = eligible.map((docSnap) => docSnap.id);
        const profileDocs = uids.length
            ? await db.getAll(...uids.map((uid) => db.collection("profiles").doc(uid)))
            : [];
        const profilesByUid = new Map(profileDocs.map((docSnap) => [docSnap.id, docSnap.data()]));

        for (const docSnap of eligible) {
            const data = docSnap.data();
            const profile = profilesByUid.get(docSnap.id) || {};
            const matches = matchesAudience(audience, {
                verified: !!profile.verified,
                createdAtMs: data.createdAt?.toMillis?.() ?? null,
                lastActiveMs: profile.lastActive?.toMillis?.() ?? null,
                now,
            });
            if (matches) tokens.push(...data.fcmTokens);
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < USERS_PAGE_SIZE) break;
    }

    return tokens;
}

async function sendBroadcastPush(tokens, { title, body, link }) {
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
        const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
        const message = {
            tokens: batch,
            notification: { title, body },
            ...(link ? { webpush: { fcmOptions: { link } } } : {}),
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;
    }

    return { successCount, failureCount };
}

module.exports = { AUDIENCES, collectAudienceTokens, sendBroadcastPush };
