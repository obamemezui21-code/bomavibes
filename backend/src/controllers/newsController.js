const { getCachedNews, refreshCache } = require("../services/wwfNewsService");
const admin = require("../config/firebaseAdmin");

async function getWwfNews(req, res) {
    let cache = getCachedNews();

    // First request after a cold start: fetch synchronously instead of returning empty.
    if (!cache.updatedAt && !cache.error) {
        cache = await refreshCache();
    }

    res.json({
        articles: cache.articles,
        updatedAt: cache.updatedAt,
        error: cache.articles.length === 0 ? cache.error : null,
    });
}

// Public, unauthenticated view of the in-app announcements feed — lets the
// landing page show real platform news without loosening the Firestore
// client rules (announcements otherwise require a signed-in read).
async function getPlatformUpdates(req, res) {
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
        res.json({ updates });
    } catch (err) {
        console.error(err);
        res.status(500).json({ updates: [] });
    }
}

module.exports = { getWwfNews, getPlatformUpdates };
