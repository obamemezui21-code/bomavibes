// Turns the WordPress answer of gabontelevisions.ga into the slider's articles.
// Nothing from the outside is trusted: links and photos must really be on that
// site, so a tampered feed can't put a dangerous link in front of the members.
// Any address announced in http is served in https.
const { cleanText, truncate } = require("./newsText");

const HEADLINES_COUNT = 9;
const TITLE_MAX = 160;
const SOURCE_HOST = "gabontelevisions.ga";
const SOURCE_NAME = "Gabon Télévisions";
// "Blog" is the WordPress catch-all: a real category is named instead.
const IGNORED_CATEGORIES = new Set(["Blog", "Uncategorized", "Non classé"]);
const DEFAULT_CATEGORY = "Actualité";
// Some titles start with a "🔴": the slide's title doesn't need it.
const LEADING_SYMBOLS = /^[\p{Extended_Pictographic}️\s]+/u;

function safeUrl(value) {
    try {
        const url = new URL(value);
        const onSource = url.hostname === SOURCE_HOST || url.hostname.endsWith(`.${SOURCE_HOST}`);
        if (!onSource || !["http:", "https:"].includes(url.protocol)) return null;
        url.protocol = "https:";
        return url.href;
    } catch {
        return null;
    }
}

function parseHeadlines(posts) {
    if (!Array.isArray(posts)) return [];
    const articles = [];
    for (const post of posts) {
        const url = safeUrl(post?.link);
        const imageUrl = safeUrl(post?._embedded?.["wp:featuredmedia"]?.[0]?.source_url);
        const title = truncate(cleanText(String(post?.title?.rendered || "")).replace(LEADING_SYMBOLS, ""), TITLE_MAX);
        // A slide needs a photo and a title: the others are skipped.
        if (!Number.isInteger(post?.id) || !url || !imageUrl || !title) continue;

        const categories = (post._embedded?.["wp:term"]?.flat() || [])
            .filter((t) => t?.taxonomy === "category" && t.name)
            .map((t) => cleanText(t.name));
        const date = post.date_gmt ? new Date(`${post.date_gmt}Z`) : null;
        articles.push({
            id: post.id,
            title,
            url,
            imageUrl,
            source: SOURCE_NAME,
            category: categories.find((name) => !IGNORED_CATEGORIES.has(name)) || DEFAULT_CATEGORY,
            publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
        });
        if (articles.length === HEADLINES_COUNT) break;
    }
    return articles;
}

module.exports = { HEADLINES_COUNT, parseHeadlines };
