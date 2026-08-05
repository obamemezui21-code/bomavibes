const { getCachedNews, refreshCache } = require("../services/wwfNewsService");

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

module.exports = { getWwfNews };
