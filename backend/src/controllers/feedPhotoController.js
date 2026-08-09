const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "feed-posts");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

// Same naming convention as profile photos (photo-{id}.jpg / photo-{id}-thumb.jpg)
// so the frontend's photoVariant() helper works unchanged on feed photo URLs too.
const VARIANTS = [
    { key: "full", suffix: "", maxWidth: 1600, quality: 82 },
    { key: "thumb", suffix: "-thumb", maxWidth: 480, quality: 75 },
];

async function uploadFeedPhoto(req, res) {
    const uid = req.firebaseUser.uid;

    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });

        const normalized = await sharp(req.file.path).rotate().toBuffer();
        const timestamp = Date.now();
        const urls = {};

        await Promise.all(
            VARIANTS.map(async ({ key, suffix, maxWidth, quality }) => {
                const filename = `photo-${timestamp}${suffix}.jpg`;
                await sharp(normalized)
                    .resize({ width: maxWidth, withoutEnlargement: true })
                    .jpeg({ quality, mozjpeg: true })
                    .toFile(path.join(dir, filename));
                urls[key] = `${FRONTEND_URL}/uploads/feed-posts/${uid}/${filename}`;
            }),
        );

        fs.unlink(req.file.path, () => {});

        res.json({ url: urls.full, thumbUrl: urls.thumb });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer la photo" });
    }
}

module.exports = { uploadFeedPhoto };
