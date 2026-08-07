const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "chat-attachments");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const MAX_IMAGE_WIDTH = 1600;

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

async function uploadChatAttachment(req, res) {
    const uid = req.firebaseUser.uid;

    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const isImage = req.file.mimetype.startsWith("image/");
        const timestamp = Date.now();

        if (isImage) {
            const filename = `image-${timestamp}.jpg`;
            const destPath = path.join(dir, filename);
            // Normalize EXIF rotation and cap the width, same approach as
            // profile photos — chat images shouldn't ship full camera
            // resolution either.
            await sharp(req.file.path)
                .rotate()
                .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
                .jpeg({ quality: 82, mozjpeg: true })
                .toFile(destPath);
            fs.unlink(req.file.path, () => {});

            return res.json({
                type: "image",
                url: `${FRONTEND_URL}/uploads/chat-attachments/${uid}/${filename}`,
                fileName: sanitizeFileName(req.file.originalname || "photo.jpg"),
                fileSize: fs.statSync(destPath).size,
            });
        }

        const safeName = sanitizeFileName(req.file.originalname || "fichier");
        const filename = `file-${timestamp}-${safeName}`;
        const destPath = path.join(dir, filename);
        fs.renameSync(req.file.path, destPath);

        res.json({
            type: "file",
            url: `${FRONTEND_URL}/uploads/chat-attachments/${uid}/${filename}`,
            fileName: safeName,
            fileSize: req.file.size,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer le fichier" });
    }
}

module.exports = { uploadChatAttachment };
