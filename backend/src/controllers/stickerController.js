const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "stickers");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const MAX_STICKERS = 60;
const SIZE = 512;

// User-made chat stickers. The app composes the sticker (crop, shape, text,
// emoji) and sends a transparent PNG; it's normalised to a 512 × 512 WebP
// here and listed in customStickers/{id} { ownerId, url, createdAt } —
// written only through these routes (see firestore.rules).

// POST /api/stickers (multipart: sticker) → { id, url }
async function createSticker(req, res) {
    const uid = req.firebaseUser.uid;
    if (!req.file) return res.status(400).json({ message: "Aucune image reçue" });

    try {
        const count = await db.collection("customStickers").where("ownerId", "==", uid).count().get();
        if (count.data().count >= MAX_STICKERS) {
            return res.status(409).json({ message: `Vous avez déjà ${MAX_STICKERS} stickers : supprimez-en un pour en créer un autre.` });
        }

        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const filename = `sticker-${Date.now()}.webp`;
        await sharp(req.file.path)
            .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 85, alphaQuality: 90 })
            .toFile(path.join(dir, filename));

        const url = `${FRONTEND_URL}/uploads/stickers/${uid}/${filename}`;
        const ref = await db.collection("customStickers").add({ ownerId: uid, url, createdAt: FieldValue.serverTimestamp() });
        res.json({ id: ref.id, url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de créer le sticker" });
    } finally {
        fs.unlink(req.file.path, () => {});
    }
}

// DELETE /api/stickers/:id — removes it from "Mes stickers". Messages that
// already used it keep showing it (the file stays, like a sent photo).
async function deleteSticker(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const ref = db.collection("customStickers").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data().ownerId !== uid) return res.status(404).json({ message: "Sticker introuvable" });
        await ref.delete();
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer le sticker" });
    }
}

module.exports = { createSticker, deleteSticker };
