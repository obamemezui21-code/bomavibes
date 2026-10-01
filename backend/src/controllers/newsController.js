const admin = require("../config/firebaseAdmin");

// Announcements change rarely (admin-authored), but this route is public
// and unauthenticated — every landing-page visit (including bots/uptime
// pings, which don't share a browser cache) was re-querying Firestore with
// no throttling at all. A short in-memory cache cuts that to one read per
// interval no matter how many people hit the page.
const UPDATES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let updatesCache = { updates: null, fetchedAt: 0 };

// Public, unauthenticated view of the in-app announcements feed — lets the
// landing page show real platform news without loosening the Firestore
// client rules (announcements otherwise require a signed-in read).
async function getPlatformUpdates(req, res) {
    const isFresh = updatesCache.updates && Date.now() - updatesCache.fetchedAt < UPDATES_CACHE_TTL_MS;
    if (isFresh) {
        return res.json({ updates: updatesCache.updates });
    }

    try {
        const db = admin.firestore();
        const snap = await db.collection("announcements").orderBy("createdAt", "desc").limit(4).get();
        const updates = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                description: data.description,
                ctaLabel: data.ctaLabel || null,
                ctaLink: data.ctaLink || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
        });
        updatesCache = { updates, fetchedAt: Date.now() };
        res.json({ updates });
    } catch (err) {
        console.error(err);
        // Quota/transient errors: prefer stale-but-correct data over an
        // empty list if we have any from a previous successful fetch.
        if (updatesCache.updates) {
            return res.json({ updates: updatesCache.updates });
        }
        res.status(500).json({ updates: [] });
    }
}

module.exports = { getPlatformUpdates };
