const cheerio = require("cheerio");

const SOURCE_URL = "https://www.wwfgabon.org/en/news/publications_list/";
const BASE_URL = "https://www.wwfgabon.org";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const EXCERPT_MAX_LENGTH = 150;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cache = { articles: [], updatedAt: null, error: null };

function truncate(text, maxLength) {
    let clean = (text || "").replace(/\s+/g, " ").trim();
    if (clean.toLowerCase() === "null") clean = "";
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength - 1).trimEnd() + "…";
}

function resolveLink(href) {
    if (!href) return SOURCE_URL;
    // WWF Gabon uses relative query-string permalinks like "?58351/Article-Slug"
    return href.startsWith("http") ? href : `${SOURCE_URL}${href}`;
}

async function scrapeWwfNews() {
    const res = await fetch(SOURCE_URL, {
        headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`WWF Gabon a répondu avec le statut ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const articles = [];
    $(".today-grid-item").each((_, el) => {
        const card = $(el);
        const title = card.find(".followh2").first().text().trim();
        const summary = card.find("p").first().text().trim();
        const image = card.find("img.grid-item-image").first().attr("src");
        const href = card.find("a.today-grid-block").first().attr("href");

        if (!title) return;

        articles.push({
            id: href || title,
            title,
            excerpt: truncate(summary, EXCERPT_MAX_LENGTH),
            image: image ? (image.startsWith("http") ? image : `https:${image}`) : null,
            url: resolveLink(href),
            // WWF Gabon doesn't expose a publish date on this listing or on individual
            // article pages, so this stays null rather than showing a made-up date.
            publishedAt: null,
        });
    });

    return articles;
}

async function refreshCache() {
    try {
        const articles = await scrapeWwfNews();
        if (articles.length > 0) {
            cache = { articles, updatedAt: new Date().toISOString(), error: null };
        } else {
            // Empty result is more likely a markup change than genuinely zero articles;
            // keep serving the last known-good cache instead of wiping it out.
            cache = { ...cache, error: "Aucun article trouvé (structure de la page peut-être modifiée)" };
        }
    } catch (err) {
        cache = { ...cache, error: err.message };
    }
    return cache;
}

function getCachedNews() {
    return cache;
}

function startWwfNewsScheduler() {
    refreshCache();
    setInterval(refreshCache, REFRESH_INTERVAL_MS);
}

module.exports = { getCachedNews, refreshCache, startWwfNewsScheduler };
