// "À la une": the latest articles of gouvernement.ga for the slider at the top
// of Découvrir. Read every HEADLINES_INTERVAL_MS by the server alone (members
// never call that site), kept in memory, with each photo stored on our server
// by newsService. What can't be refreshed keeps the previous list.
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR, storeImage } = require("./newsService");
const { parseHeadlines } = require("./headlinesParser");

// Category 10: "Actualités", https://gouvernement.ga/category/actualites/
const API_URL =
    "https://gouvernement.ga/wp-json/wp/v2/posts?categories=10&per_page=15&_embed=wp:featuredmedia,wp:term&_fields=id,date_gmt,link,title,_links,_embedded";
const HEADLINES_INTERVAL_MS = 30 * 60 * 1000;
const FILE_PREFIX = "gouvernement-une-";
const KEEP_IMAGES_MS = 3 * 24 * 60 * 60 * 1000;

let headlines = [];

function currentHeadlines() {
    return headlines;
}

// Photos of articles long gone from the slider, never one still showing.
function pruneImages() {
    const cutoff = Date.now() - KEEP_IMAGES_MS;
    const showing = new Set(headlines.map((h) => path.basename(h.image)));
    let names = [];
    try {
        names = fs.readdirSync(UPLOAD_DIR);
    } catch {
        return;
    }
    for (const name of names) {
        if (!name.startsWith(FILE_PREFIX) || showing.has(name)) continue;
        const file = path.join(UPLOAD_DIR, name);
        try {
            if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
        } catch {
            // Already gone: nothing to do.
        }
    }
}

async function refreshHeadlines() {
    try {
        const res = await fetch(API_URL, {
            headers: { "User-Agent": "BomaVibesBot/1.0 (+https://bomavibes.tech)" },
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`gouvernement.ga → ${res.status}`);
        const articles = parseHeadlines(await res.json());

        const stored = [];
        for (const { imageUrl, ...article } of articles) {
            const filename = `${FILE_PREFIX}${article.id}.jpg`;
            // An article's photo doesn't change: it isn't fetched twice.
            const known = headlines.find((h) => h.id === article.id)?.image;
            const image = known || (await storeImage(filename, imageUrl));
            if (image) stored.push({ ...article, image });
        }
        if (stored.length) headlines = stored;
        pruneImages();
    } catch (err) {
        console.error("[à la une] mise à jour impossible", err.message);
    }
}

function startHeadlinesScheduler() {
    refreshHeadlines();
    setInterval(refreshHeadlines, HEADLINES_INTERVAL_MS);
}

module.exports = { currentHeadlines, refreshHeadlines, startHeadlinesScheduler };
