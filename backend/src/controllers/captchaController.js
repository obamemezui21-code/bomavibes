// Self-hosted, visible "select all the images that show X" captcha for the
// signup form (feu rouge / vélo / passage piéton / …) — no external service,
// no API keys, no domain allow-listing. Stateless: the target category, the
// full 3x3 grid layout and an expiry are signed with CAPTCHA_SECRET and
// handed back inside the token, so verifying a submission later needs no
// session or DB row — just recomputing the HMAC and checking which cells in
// that same signed grid match the target.
const crypto = require("crypto");

const SECRET = process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.CAPTCHA_SECRET) {
    console.warn(
        "CAPTCHA_SECRET is not set — using a random secret for this process. " +
            "Tokens won't survive a restart. Set CAPTCHA_SECRET in .env for production."
    );
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const GRID_SIZE = 9;
// Keep in sync with the CATEGORIES map in frontend-web/src/components/ImageGridCaptcha.jsx.
const CATEGORIES = ["feu-rouge", "velo", "passage-pieton", "bus", "voiture", "camion"];

function sign(payload) {
    return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildGrid(target) {
    const distractors = CATEGORIES.filter((c) => c !== target);
    const matchCount = crypto.randomInt(2, 5); // 2-4 correct cells, never 0 or "all of them"
    const cells = Array.from({ length: matchCount }, () => target);
    while (cells.length < GRID_SIZE) cells.push(distractors[crypto.randomInt(0, distractors.length)]);
    return shuffle(cells);
}

function getChallenge(req, res) {
    const target = CATEGORIES[crypto.randomInt(0, CATEGORIES.length)];
    const cells = buildGrid(target);
    const expires = Date.now() + CHALLENGE_TTL_MS;
    const rawPayload = JSON.stringify({ target, cells, expires });
    const token = `${Buffer.from(rawPayload).toString("base64url")}.${sign(rawPayload)}`;

    res.json({ target, cells, token });
}

function verifyCaptcha(req, res) {
    const { token, indices } = req.body || {};
    if (typeof token !== "string" || !Array.isArray(indices) || indices.length === 0) {
        return res.status(400).json({ success: false, message: "Vérification anti-robot requise" });
    }

    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
        return res.status(400).json({ success: false, message: "Vérification anti-robot invalide, réessayez" });
    }

    let rawPayload;
    try {
        rawPayload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    } catch {
        return res.status(400).json({ success: false, message: "Vérification anti-robot invalide, réessayez" });
    }

    if (sign(rawPayload) !== signature) {
        return res.status(400).json({ success: false, message: "Vérification anti-robot invalide, réessayez" });
    }

    let payload;
    try {
        payload = JSON.parse(rawPayload);
    } catch {
        return res.status(400).json({ success: false, message: "Vérification anti-robot invalide, réessayez" });
    }

    const { target, cells, expires } = payload;
    if (!Number.isFinite(expires) || Date.now() > expires) {
        return res.status(400).json({ success: false, message: "Vérification expirée, réessayez" });
    }

    const correct = new Set(cells.reduce((acc, c, i) => (c === target ? [...acc, i] : acc), []));
    const submitted = new Set(indices.map(Number));
    const isCorrect = correct.size === submitted.size && [...correct].every((i) => submitted.has(i));

    if (!isCorrect) {
        return res.status(400).json({ success: false, message: "Sélection incorrecte, réessayez" });
    }

    res.json({ success: true });
}

module.exports = { getChallenge, verifyCaptcha };
