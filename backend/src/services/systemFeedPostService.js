// Auto-publishes a branded card to the social Feed (posts collection) on
// behalf of an official "BomaVibes" account, for two triggers:
//   - contentService.js, when an event is published
//   - notificationsController.js, when an admin sends a broadcast with
//     "publier aussi comme annonce interne" checked
// The card is generated server-side with sharp (gradient/event photo
// background + the platform logo + title text) — no external image API,
// consistent with the rest of this app's self-hosted approach.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "feed-posts", "system");
const LOGO_PATH = path.join(__dirname, "..", "..", "..", "frontend-web", "public", "bomavibes-logo.jpeg");

// Not a real Firebase Auth user — just a reserved `profiles` doc id, written
// directly via the Admin SDK (which bypasses Firestore rules), so posts
// authored with this id render in the Feed like any other user's post.
const OFFICIAL_UID = "bomavibes-official";

const CARD_W = 1200;
const CARD_H = 630;

function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

// Greedy word-wrap into at most `maxLines` lines of ~`maxCharsPerLine`
// characters, ellipsizing the last line if the text doesn't fit — good
// enough for a title rendered at a fixed font size on a fixed-size card.
function wrapText(text, maxCharsPerLine, maxLines) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines = [];
    let current = "";
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxCharsPerLine && current) {
            lines.push(current);
            current = word;
            if (lines.length === maxLines) break;
        } else {
            current = candidate;
        }
    }
    if (lines.length < maxLines && current) lines.push(current);

    const consumedWords = lines.join(" ").split(/\s+/).length;
    if (consumedWords < words.length) {
        const last = lines[lines.length - 1];
        const cut = last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 1) : last;
        lines[lines.length - 1] = `${cut}…`;
    }
    return lines;
}

async function ensureOfficialProfile() {
    await db.collection("profiles").doc(OFFICIAL_UID).set(
        {
            firstName: "BomaVibes",
            photos: [`${FRONTEND_URL}/bomavibes-logo.jpeg`],
            isOfficial: true,
        },
        { merge: true }
    );
}

async function buildBackgroundLayer(imageUrl) {
    if (imageUrl) {
        try {
            const res = await fetch(imageUrl);
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                return await sharp(buf).resize(CARD_W, CARD_H, { fit: "cover" }).toBuffer();
            }
        } catch (err) {
            console.error("systemFeedPostService: couldn't fetch source image, falling back to gradient", err);
        }
    }

    const gradientSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#6a4693"/>
                <stop offset="55%" stop-color="#c63c8a"/>
                <stop offset="100%" stop-color="#ad2f74"/>
            </linearGradient>
        </defs>
        <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>
        <circle cx="1060" cy="90" r="240" fill="rgba(255,255,255,0.08)"/>
        <circle cx="70" cy="${CARD_H - 60}" r="170" fill="rgba(255,255,255,0.07)"/>
    </svg>`;
    return sharp(Buffer.from(gradientSvg)).png().toBuffer();
}

async function generateBrandedImage({ kicker, title, subtitle, imageUrl }) {
    const background = await buildBackgroundLayer(imageUrl);

    // Darkening wash so white text stays legible whether the background is
    // the brand gradient or an arbitrary event photo.
    const overlaySvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(20,12,24,0.25)"/>
                <stop offset="45%" stop-color="rgba(20,12,24,0.35)"/>
                <stop offset="100%" stop-color="rgba(20,12,24,0.82)"/>
            </linearGradient>
        </defs>
        <rect width="${CARD_W}" height="${CARD_H}" fill="url(#overlay)"/>
    </svg>`;

    const titleLines = wrapText(title, 22, 2);
    const titleStartY = 460;
    const titleLineHeight = 54;
    const titleTspans = titleLines
        .map((line, i) => `<tspan x="150" y="${titleStartY + i * titleLineHeight}">${escapeXml(line)}</tspan>`)
        .join("");
    const subtitleY = titleStartY + titleLines.length * titleLineHeight + 24;

    const textSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <text x="138" y="98" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#ffffff">BomaVibes</text>
        <text x="150" y="410" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="#f3e2ff">${escapeXml(
            String(kicker || "").toUpperCase()
        )}</text>
        <text font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800" fill="#ffffff">${titleTspans}</text>
        ${subtitle ? `<text x="150" y="${subtitleY}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="rgba(255,255,255,0.88)">${escapeXml(subtitle)}</text>` : ""}
    </svg>`;

    const logo = await sharp(LOGO_PATH).resize(64, 64, { fit: "cover" }).toBuffer();
    const logoMask = Buffer.from(`<svg width="64" height="64"><circle cx="32" cy="32" r="32" fill="#fff"/></svg>`);
    const roundedLogo = await sharp(logo)
        .composite([{ input: logoMask, blend: "dest-in" }])
        .png()
        .toBuffer();

    return sharp(background)
        .composite([
            { input: Buffer.from(overlaySvg), top: 0, left: 0 },
            { input: roundedLogo, top: 56, left: 60 },
            { input: Buffer.from(textSvg), top: 0, left: 0 },
        ])
        .jpeg({ quality: 87, mozjpeg: true })
        .toBuffer();
}

async function publishBrandedPost({ kicker, title, subtitle, imageUrl, caption }) {
    await ensureOfficialProfile();
    const imageBuffer = await generateBrandedImage({ kicker, title, subtitle, imageUrl });

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), imageBuffer);
    const url = `${FRONTEND_URL}/uploads/feed-posts/system/${filename}`;

    const ref = await db.collection("posts").add({
        authorId: OFFICIAL_UID,
        type: "photo",
        text: caption || null,
        photoUrl: url,
        photoThumbUrl: url,
        likeCount: 0,
        commentCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        editedAt: null,
    });
    return ref.id;
}

// Regenerates the branded card for an existing post in place (same id, so
// likes/comments on it aren't lost) — used when an admin edits an
// announcement after the fact, so the image doesn't keep showing stale text.
async function updateBrandedPost(postId, { kicker, title, subtitle, imageUrl, caption }) {
    const imageBuffer = await generateBrandedImage({ kicker, title, subtitle, imageUrl });

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), imageBuffer);
    const url = `${FRONTEND_URL}/uploads/feed-posts/system/${filename}`;

    await db.collection("posts").doc(postId).update({
        text: caption || null,
        photoUrl: url,
        photoThumbUrl: url,
        editedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function deleteFeedPost(postId) {
    await db.collection("posts").doc(postId).delete();
}

function formatEventSubtitle(event) {
    const parts = [];
    if (event.date) {
        const d = new Date(`${event.date}T00:00:00`);
        parts.push(Number.isNaN(d.getTime()) ? event.date : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
    }
    if (event.location) parts.push(event.location);
    return parts.join(" · ") || null;
}

async function postNewEventToFeed(event) {
    return publishBrandedPost({
        kicker: "Nouvel événement",
        title: event.title,
        subtitle: formatEventSubtitle(event),
        imageUrl: event.image || null,
        caption: `🎉 Nouvel événement : ${event.title}\nRéserve ta place dans l'onglet Événements.`,
    });
}

async function postAnnouncementToFeed({ title, message }) {
    return publishBrandedPost({
        kicker: "Annonce",
        title,
        subtitle: null,
        imageUrl: null,
        caption: message,
    });
}

async function updateAnnouncementFeedPost(postId, { title, message }) {
    return updateBrandedPost(postId, { kicker: "Annonce", title, subtitle: null, imageUrl: null, caption: message });
}

module.exports = {
    postNewEventToFeed,
    postAnnouncementToFeed,
    updateAnnouncementFeedPost,
    deleteFeedPost,
    OFFICIAL_UID,
};
