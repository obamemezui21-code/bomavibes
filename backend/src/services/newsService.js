// Brings news from outside sources into the Feed (Populaire tab): every few
// hours each source in SOURCES is read and its new articles become posts by
// the official BomaVibes account, with the article's photo, title and
// opening lines, its source named and a link to the full article (rendered
// by NewsCard in the app — fields under `news`).
//
// Two kinds of source:
//   rss  — a standard RSS feed (title, link, description, image)
//   html — a site without a feed, read from its news list page (the
//          Ministry of the Interior)
// Imported article ids live in newsSources/{source.id} (Admin SDK only).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { OFFICIAL_UID } = require("./systemFeedPostService");

const db = admin.firestore();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "feed-posts", "news");
const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;
const SUMMARY_MAX = 320;

// Gabonreview's culture feed mixes cinema, books, music…: only the music
// stories are kept.
const MUSIC_WORDS =
  /(?<!\p{L})(musique|musical|musicien|musicienne|chanson|chanteur|chanteuse|album|single|clip|concert|rap|rappeur|rappeuse|showcase|orchestre|tradi-moderne|afrobeat|coupé-décalé|zouk|hip-hop|dj|grammy|micro)s?(?!\p{L})/iu;

// category: the badge on the card. maxPerRun / firstRunCount: how many new
// articles one check may post (the first check only the latest few) — keeps
// Populaire from being flooded by busy feeds.
const SOURCES = [
  {
    id: "interieur-gouv-ga",
    kind: "html",
    name: "Ministère de l'Intérieur",
    category: "Actu Gabon",
    site: "https://www.interieur.gouv.ga",
    listPath: "/actualites",
    articlePattern: /href="(\/9-actualites\/(\d+)-[^"#?]+)"/g,
    maxPerRun: 5,
    firstRunCount: 3,
  },
  {
    id: "gabonreview-musique",
    kind: "rss",
    name: "Gabonreview",
    category: "Musique Gabon",
    feedUrl: "https://www.gabonreview.com/category/culture/feed/",
    filter: (item) => MUSIC_WORDS.test(`${item.title} ${item.summary}`),
    maxPerRun: 2,
    firstRunCount: 2,
  },
  {
    id: "gabonactu-musique",
    kind: "rss",
    name: "Gabonactu",
    category: "Musique Gabon",
    feedUrl: "https://www.gabonactu.com/feed/",
    filter: (item) => MUSIC_WORDS.test(`${item.title} ${item.summary}`),
    maxPerRun: 2,
    firstRunCount: 1,
  },
  {
    id: "rfi-afrique",
    kind: "rss",
    name: "RFI Afrique",
    category: "Afrique",
    feedUrl: "https://www.rfi.fr/fr/afrique/rss",
    maxPerRun: 1,
    firstRunCount: 2,
  },
];

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", oelig: "œ", OElig: "Œ", aelig: "æ", deg: "°", euro: "€",
};
const ACCENT_MARKS = { acute: "́", grave: "̀", circ: "̂", uml: "̈", cedil: "̧", tilde: "̃" };

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([A-Za-z])(acute|grave|circ|uml|cedil|tilde);/g, (_, letter, mark) => (letter + ACCENT_MARKS[mark]).normalize("NFC"))
    .replace(/&([A-Za-z]+);/g, (whole, name) => NAMED_ENTITIES[name] ?? whole);
}

function cleanText(html) {
  return decodeEntities(html.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.]+$/, "")}…`;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "BomaVibesBot/1.0 (+https://bomavibes.tech)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

// ---- RSS ------------------------------------------------------------------

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : "";
}

function attr(xml, name, attribute) {
  const match = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]+)"`, "i"));
  return match ? decodeEntities(match[1]) : null;
}

// Newest first, as in the feed. Each item is complete: no page to fetch.
function parseRss(xml) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map((item) => {
    const link = cleanText(tag(item, "link"));
    const description = tag(item, "description").replace(/<!\[CDATA\[|\]\]>/g, "");
    // WordPress appends "L'article … est apparu en premier sur …".
    const summaryHtml = description.replace(/<p>\s*L[’']article\s[\s\S]*?est apparu en premier sur[\s\S]*?<\/p>/i, "");
    const image =
      attr(item, "media:content", "url") ||
      attr(item, "media:thumbnail", "url") ||
      attr(item, "enclosure", "url") ||
      (description.match(/<img[^>]+src="([^"]+)"/i) || [])[1] ||
      null;
    const pubDate = new Date(cleanText(tag(item, "pubDate")));
    return {
      id: crypto.createHash("sha1").update(cleanText(tag(item, "guid")) || link).digest("hex").slice(0, 16),
      url: link,
      title: truncate(cleanText(tag(item, "title")), 220),
      summary: truncate(cleanText(summaryHtml).replace(/\s*\[…\]$/, "…"), SUMMARY_MAX),
      imageUrl: image,
      publishedAt: Number.isNaN(pubDate.getTime()) ? null : pubDate,
    };
  });
}

// ---- HTML (Ministry of the Interior) ----------------------------------------

function meta(html, property) {
  const match = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`, "i"));
  return match ? cleanText(match[1]) : "";
}

function parseArticleList(html, source) {
  const seen = new Set();
  const articles = [];
  for (const [, href, id] of html.matchAll(source.articlePattern)) {
    if (seen.has(id)) continue;
    seen.add(id);
    articles.push({ id, url: source.site + href });
  }
  return articles;
}

function parseArticle(html, site) {
  const ogTitle = meta(html, "og:title");
  const ogDescription = meta(html, "og:description");
  // Long headlines are cut after a colon in og:title; the description
  // repeats the headline in full.
  const title = ogDescription.startsWith(ogTitle.replace(/\s*:$/, "")) && ogDescription.length <= 220 ? ogDescription : ogTitle;

  const body = html.split('class="contentArticle"')[1] || "";
  const firstParagraph = (body.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).map(cleanText).find((p) => p.length > 40) || "";

  const date = html.match(/le (\d{2})\/(\d{2})\/(\d{4})/);
  const image = html.match(/<meta property="og:image" content="([^"]+)"/i);

  return {
    title: truncate(title, 220),
    summary: truncate(firstParagraph, SUMMARY_MAX),
    publishedAt: date ? new Date(`${date[3]}-${date[2]}-${date[1]}T12:00:00Z`) : null,
    imageUrl: image ? new URL(decodeEntities(image[1]), site).href : null,
  };
}

// ---- Posting ----------------------------------------------------------------

// The article photo is kept on our server, resized, rather than loaded from
// the source site by every reader.
async function storeImage(filename, imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    await sharp(buffer)
      .rotate()
      .resize({ width: 1080, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(UPLOAD_DIR, filename));
    return `${FRONTEND_URL}/uploads/feed-posts/news/${filename}`;
  } catch (err) {
    console.error(`[actu] image ${imageUrl} indisponible`, err.message);
    return null;
  }
}

async function postArticle(source, article) {
  if (!article.title) throw new Error(`article ${article.id} sans titre`);
  const photoUrl = await storeImage(`${source.id}-${article.id}.jpg`, article.imageUrl);
  const site = new URL(article.url).hostname.replace(/^www\./, "");

  await db.collection("posts").add({
    authorId: OFFICIAL_UID,
    type: photoUrl ? "photo" : "text",
    text: article.title,
    photoUrl,
    photoThumbUrl: photoUrl,
    news: {
      category: source.category,
      source: source.name,
      sourceSite: site,
      url: article.url,
      title: article.title,
      summary: article.summary || null,
      publishedAt: article.publishedAt ? admin.firestore.Timestamp.fromDate(article.publishedAt) : null,
    },
    likeCount: 0,
    commentCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    editedAt: null,
  });
}

// The source's current articles, newest first. RSS items come complete;
// the html source only gives links, each article page is read when posted.
async function listArticles(source) {
  if (source.kind === "rss") {
    const items = parseRss(await fetchPage(source.feedUrl)).filter((i) => i.url);
    return source.filter ? items.filter(source.filter) : items;
  }
  return parseArticleList(await fetchPage(source.site + source.listPath), source);
}

async function completeArticle(source, article) {
  if (source.kind === "rss") return article;
  return { ...article, ...parseArticle(await fetchPage(article.url), source.site) };
}

async function checkSource(source) {
  try {
    const articles = await listArticles(source);
    const stateRef = db.collection("newsSources").doc(source.id);
    const state = await stateRef.get();
    const firstRun = !state.exists;
    const seenIds = new Set(firstRun ? [] : state.data().seenIds || []);

    const fresh = articles.filter((a) => !seenIds.has(a.id));
    // Oldest first, so the newest article ends up on top of the Feed.
    const toPost = fresh.slice(0, firstRun ? source.firstRunCount : source.maxPerRun).reverse();
    // The first check, and articles past this check's quota, are not
    // posted later: only what's new from now on.
    articles.forEach((a) => {
      if (firstRun || !toPost.includes(a)) seenIds.add(a.id);
    });

    let posted = 0;
    for (const article of toPost) {
      try {
        await postArticle(source, await completeArticle(source, article));
        posted += 1;
        seenIds.add(article.id);
      } catch (err) {
        console.error(`[actu] ${source.id} : article ${article.id} non publié`, err.message); // retried next check
      }
    }

    await stateRef.set({
      seenIds: [...seenIds].slice(-500),
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (posted) console.log(`[actu] ${posted} article(s) publié(s) depuis ${source.name}`);
  } catch (err) {
    console.error(`[actu] ${source.id} : vérification impossible`, err.message);
  }
}

async function checkNews() {
  for (const source of SOURCES) await checkSource(source);
}

function startNewsScheduler() {
  setTimeout(checkNews, 60 * 1000); // let the server finish starting
  setInterval(checkNews, CHECK_INTERVAL_MS);
}

module.exports = { SOURCES, checkNews, listArticles, parseArticle, parseRss, startNewsScheduler };
