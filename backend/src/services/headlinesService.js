// "À la une": the latest articles of gabontelevisions.ga for the slider at the
// top of Découvrir. Read every HEADLINES_INTERVAL_MS by the server alone
// (members never call that site), with each photo stored on our server by
// newsService. What can't be refreshed keeps the previous list, and that list
// is also kept on disk, so a restart while the site is down doesn't empty the
// slider.
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR, storeImage } = require("./newsService");
const { parseHeadlines } = require("./headlinesParser");

// All categories: the site has no single "news" one.
const API_URL =
    "https://gabontelevisions.ga/wp-json/wp/v2/posts?per_page=20&_embed=wp:featuredmedia,wp:term&_fields=id,date_gmt,link,title,_links,_embedded";
const HEADLINES_INTERVAL_MS = 30 * 60 * 1000;
const FILE_PREFIX = "gtv-une-";
// Photos of the former source (gouvernement.ga), pruned the same way.
const OLD_PREFIXES = ["gouvernement-une-"];
const KEEP_IMAGES_MS = 3 * 24 * 60 * 60 * 1000;
// Not under uploads/: this file isn't meant to be served.
const SAVED_FILE = path.join(__dirname, "..", "..", "private", "a-la-une.json");

let headlines = [];

function currentHeadlines() {
    return headlines;
}

// The list saved by the last good refresh, if its photos are still there.
function loadSaved() {
    try {
        const saved = JSON.parse(fs.readFileSync(SAVED_FILE, "utf8"));
        if (!Array.isArray(saved)) return;
        const usable = saved.filter((h) => h?.image && fs.existsSync(path.join(UPLOAD_DIR, path.basename(h.image))));
        if (usable.length) headlines = usable;
    } catch {
        // Nothing saved yet: the first refresh fills the list.
    }
}

function save() {
    try {
        fs.mkdirSync(path.dirname(SAVED_FILE), { recursive: true });
        fs.writeFileSync(`${SAVED_FILE}.tmp`, JSON.stringify(headlines));
        fs.renameSync(`${SAVED_FILE}.tmp`, SAVED_FILE);
    } catch (err) {
        console.error("[à la une] sauvegarde impossible", err.message);
    }
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
        const ours = [FILE_PREFIX, ...OLD_PREFIXES].some((prefix) => name.startsWith(prefix));
        if (!ours || showing.has(name)) continue;
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
        if (!res.ok) throw new Error(`gabontelevisions.ga → ${res.status}`);
        const articles = parseHeadlines(await res.json());

        const stored = [];
        for (const { imageUrl, ...article } of articles) {
            const filename = `${FILE_PREFIX}${article.id}.jpg`;
            // An article's photo doesn't change: it isn't fetched twice.
            const known = headlines.find((h) => h.id === article.id && path.basename(h.image) === filename)?.image;
            const image = known || (await storeImage(filename, imageUrl));
            if (image) stored.push({ ...article, image });
        }
        if (stored.length) {
            headlines = stored;
            save();
        }
        pruneImages();
    } catch (err) {
        console.error("[à la une] mise à jour impossible", err.message);
    }
}

function startHeadlinesScheduler() {
    loadSaved();
    refreshHeadlines();
    setInterval(refreshHeadlines, HEADLINES_INTERVAL_MS);
}

module.exports = { currentHeadlines, refreshHeadlines, startHeadlinesScheduler };
