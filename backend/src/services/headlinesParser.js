// Turns the WordPress answer of gouvernement.ga into the slider's articles.
// Nothing from the outside is trusted: links and photos must really be on that
// site, so a tampered feed can't put a dangerous link in front of the members.
// The site announces its own addresses in http; it serves them all in https.
const { cleanText, truncate } = require("./newsText");

const HEADLINES_COUNT = 9;
const TITLE_MAX = 160;
const SOURCE_HOST = "gouvernement.ga";
const SOURCE_NAME = "Gouvernement.ga";
// Every article is in this category: the second one names the ministry.
const GENERAL_CATEGORY = "Actualités";

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
        const title = truncate(cleanText(String(post?.title?.rendered || "")), TITLE_MAX);
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
            category: categories.find((name) => name !== GENERAL_CATEGORY) || GENERAL_CATEGORY,
            publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
        });
        if (articles.length === HEADLINES_COUNT) break;
    }
    return articles;
}

module.exports = { HEADLINES_COUNT, parseHeadlines };
