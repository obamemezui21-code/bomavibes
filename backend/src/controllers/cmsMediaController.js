// Media library behind the CMS content editor (Pages/Articles/FAQ/
// Bannières all take an image field). There is no Firebase Storage in this
// app — every upload here (like feed photos, music, chat attachments) goes
// to local VPS disk under backend/uploads/ and is served statically from
// there — so "list" is a plain directory read, not a Firestore query.
// Deliberately scoped to admin-uploaded content images only, never a
// browser into user-private uploads (profile photos, chat attachments,
// voice notes) — see the mission's "never expose private files
// needlessly".
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "cms-media");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const PUBLIC_PREFIX = `${FRONTEND_URL}/uploads/cms-media/`;
const THUMB_SUFFIX = "-thumb";

function isSafeFilename(name) {
    return typeof name === "string" && name.length > 0 && !name.includes("/") && !name.includes("..");
}

async function uploadCmsMedia(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
        const timestamp = Date.now();
        const filename = `${timestamp}.jpg`;
        const thumbFilename = `${timestamp}${THUMB_SUFFIX}.jpg`;

        const normalized = await sharp(req.file.path).rotate().toBuffer();
        await sharp(normalized)
            .resize({ width: 1600, withoutEnlargement: true })
            .jpeg({ quality: 82, mozjpeg: true })
            .toFile(path.join(UPLOAD_ROOT, filename));
        await sharp(normalized)
            .resize({ width: 400, withoutEnlargement: true })
            .jpeg({ quality: 75, mozjpeg: true })
            .toFile(path.join(UPLOAD_ROOT, thumbFilename));

        fs.unlink(req.file.path, () => {});

        const stats = fs.statSync(path.join(UPLOAD_ROOT, filename));
        res.status(201).json({
            file: {
                name: filename,
                url: `${PUBLIC_PREFIX}${filename}`,
                thumbUrl: `${PUBLIC_PREFIX}${thumbFilename}`,
                size: stats.size,
                uploadedAt: stats.mtime.toISOString(),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer l'image" });
    }
}

function listCmsMedia(req, res) {
    try {
        fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
        const names = fs.readdirSync(UPLOAD_ROOT).filter((name) => !name.endsWith(`${THUMB_SUFFIX}.jpg`));

        const files = names
            .map((name) => {
                const stats = fs.statSync(path.join(UPLOAD_ROOT, name));
                const thumbName = name.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`);
                const hasThumb = fs.existsSync(path.join(UPLOAD_ROOT, thumbName));
                return {
                    name,
                    url: `${PUBLIC_PREFIX}${name}`,
                    thumbUrl: hasThumb ? `${PUBLIC_PREFIX}${thumbName}` : `${PUBLIC_PREFIX}${name}`,
                    size: stats.size,
                    uploadedAt: stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        res.json({ files });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

function deleteCmsMedia(req, res) {
    const { name } = req.params;
    if (!isSafeFilename(name)) {
        return res.status(400).json({ message: "Nom de fichier invalide" });
    }

    try {
        fs.unlink(path.join(UPLOAD_ROOT, name), (err) => {
            if (err && err.code !== "ENOENT") console.error(err);
        });
        const thumbName = name.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`);
        fs.unlink(path.join(UPLOAD_ROOT, thumbName), (err) => {
            if (err && err.code !== "ENOENT") console.error(err);
        });
        res.json({ message: "Fichier supprimé" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer ce fichier" });
    }
}

module.exports = { uploadCmsMedia, listCmsMedia, deleteCmsMedia };
