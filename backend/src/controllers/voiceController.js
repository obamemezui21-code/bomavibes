const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "voice-notes");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

async function uploadVoiceNote(req, res) {
    const uid = req.firebaseUser.uid;

    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const filename = `voice-${Date.now()}.webm`;
        const destPath = path.join(dir, filename);
        fs.renameSync(req.file.path, destPath);

        const url = `${FRONTEND_URL}/uploads/voice-notes/${uid}/${filename}`;
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la note vocale" });
    }
}

module.exports = { uploadVoiceNote };
