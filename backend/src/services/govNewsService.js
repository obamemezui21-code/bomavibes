// Brings the news of the Gabonese Ministry of the Interior
// (www.interieur.gouv.ga/actualites) into the Feed. The site has no RSS
// feed: its news list is read every few hours and each new article becomes a
// post by the official BomaVibes account, with the article's photo, title and
// opening paragraph, its source named and a link to the full article
// (rendered by NewsCard in the app — fields under `news`).
//
// Imported article ids live in newsSources/{source.id} (Admin SDK only).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { OFFICIAL_UID } = require("./systemFeedPostService");

const db = admin.firestore();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "feed-posts", "news");
const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;
// The very first run only brings in the latest few: no flood of old news.
const FIRST_RUN_COUNT = 3;
const MAX_PER_RUN = 5;
const SUMMARY_MAX = 320;

const SOURCE = {
  id: "interieur-gouv-ga",
  name: "Ministère de l'Intérieur",
  site: "https://www.interieur.gouv.ga",
  listPath: "/actualites",
  articlePattern: /href="(\/9-actualites\/(\d+)-[^"#?]+)"/g,
};

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
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html, property) {
  const match = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`, "i"));
  return match ? cleanText(match[1]) : "";
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

// Newest first, as on the site.
function parseArticleList(html) {
  const seen = new Set();
  const articles = [];
  for (const [, href, id] of html.matchAll(SOURCE.articlePattern)) {
    if (seen.has(id)) continue;
    seen.add(id);
    articles.push({ id, url: SOURCE.site + href });
  }
  return articles;
}

function parseArticle(html) {
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
    imageUrl: image ? new URL(decodeEntities(image[1]), SOURCE.site).href : null,
  };
}

// The article photo is kept on our server, resized, rather than loaded
// from the ministry's site by every reader.
async function storeImage(articleId, imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${SOURCE.id}-${articleId}.jpg`;
    await sharp(buffer)
      .rotate()
      .resize({ width: 1080, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(UPLOAD_DIR, filename));
    return `${FRONTEND_URL}/uploads/feed-posts/news/${filename}`;
  } catch (err) {
    console.error(`[actu] image de l'article ${articleId} indisponible`, err.message);
    return null;
  }
}

async function importArticle(article) {
  const parsed = parseArticle(await fetchPage(article.url));
  if (!parsed.title) throw new Error(`article ${article.id} sans titre`);
  const photoUrl = await storeImage(article.id, parsed.imageUrl);

  await db.collection("posts").add({
    authorId: OFFICIAL_UID,
    type: photoUrl ? "photo" : "text",
    text: parsed.title,
    photoUrl,
    photoThumbUrl: photoUrl,
    news: {
      source: SOURCE.name,
      sourceSite: new URL(SOURCE.site).hostname.replace(/^www\./, ""),
      url: article.url,
      title: parsed.title,
      summary: parsed.summary || null,
      publishedAt: parsed.publishedAt ? admin.firestore.Timestamp.fromDate(parsed.publishedAt) : null,
    },
    likeCount: 0,
    commentCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    editedAt: null,
  });
}

async function checkGovNews() {
  try {
    const articles = parseArticleList(await fetchPage(SOURCE.site + SOURCE.listPath));
    if (!articles.length) {
      console.error("[actu] aucune actualité trouvée : la page du ministère a peut-être changé");
      return;
    }

    const stateRef = db.collection("newsSources").doc(SOURCE.id);
    const state = await stateRef.get();
    const firstRun = !state.exists;
    const seenIds = new Set(firstRun ? [] : state.data().seenIds || []);

    const fresh = articles.filter((a) => !seenIds.has(a.id));
    // Oldest first, so the newest article ends up on top of the Feed.
    const toImport = (firstRun ? fresh.slice(0, FIRST_RUN_COUNT) : fresh.slice(0, MAX_PER_RUN)).reverse();
    if (firstRun) articles.forEach((a) => seenIds.add(a.id));

    let imported = 0;
    for (const article of toImport) {
      try {
        await importArticle(article);
        imported += 1;
      } catch (err) {
        console.error(`[actu] article ${article.id} non importé`, err.message);
        if (!firstRun) continue; // retried on the next check
      }
      seenIds.add(article.id);
    }

    await stateRef.set({
      seenIds: [...seenIds].slice(-500),
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (imported) console.log(`[actu] ${imported} actualité(s) importée(s) depuis ${SOURCE.site}`);
  } catch (err) {
    console.error("[actu] vérification impossible", err.message);
  }
}

function startGovNewsScheduler() {
  setTimeout(checkGovNews, 60 * 1000); // let the server finish starting
  setInterval(checkGovNews, CHECK_INTERVAL_MS);
}

module.exports = { checkGovNews, parseArticle, parseArticleList, startGovNewsScheduler };
