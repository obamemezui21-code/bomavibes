const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "music");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

async function uploadMusicTrack(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
        const safeName = sanitizeFileName(req.file.originalname || "piste.mp3");
        const filename = `${Date.now()}-${safeName}`;
        const destPath = path.join(UPLOAD_ROOT, filename);
        fs.renameSync(req.file.path, destPath);

        res.json({
            url: `${FRONTEND_URL}/uploads/music/${filename}`,
            fileName: safeName,
            fileSize: req.file.size,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer le fichier" });
    }
}

// Deletes the file backing a track from disk. Takes the public URL rather
// than a stored path so a track doc missing/mismatched on the Firestore
// side can't be turned into an arbitrary filesystem path — only the
// exact /uploads/music/<name> shape derived from our own upload response
// is accepted.
async function deleteMusicTrack(req, res) {
    const { url } = req.body;
    const prefix = `${FRONTEND_URL}/uploads/music/`;
    if (typeof url !== "string" || !url.startsWith(prefix)) {
        return res.status(400).json({ message: "URL de fichier invalide" });
    }

    const filename = url.slice(prefix.length);
    if (!filename || filename.includes("/") || filename.includes("..")) {
        return res.status(400).json({ message: "URL de fichier invalide" });
    }

    try {
        fs.unlink(path.join(UPLOAD_ROOT, filename), (err) => {
            if (err && err.code !== "ENOENT") console.error(err);
        });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer le fichier" });
    }
}

module.exports = { uploadMusicTrack, deleteMusicTrack };
