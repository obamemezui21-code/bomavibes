const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

// Phone camera photos routinely arrive at 4-8MB. We generate three
// ratio-preserving variants so each part of the UI loads only the
// resolution it actually displays (avatar vs swipe card vs full viewer)
// instead of one oversized master image everywhere. Naming convention:
// photo-{slot}.jpg (full/HD), photo-{slot}-medium.jpg, photo-{slot}-thumb.jpg
// — shared with backfillPhotoVariants.js and the frontend's photoVariant().
const VARIANTS = [
  { key: "full", suffix: "", maxWidth: 1080, quality: 85 },
  { key: "medium", suffix: "-medium", maxWidth: 640, quality: 80 },
  { key: "thumb", suffix: "-thumb", maxWidth: 240, quality: 75 },
];

async function uploadPhoto(req, res) {
  const uid = req.firebaseUser.uid;
  const slot = Number(req.body.slot);

  if (![0, 1, 2].includes(slot)) {
    return res.status(400).json({ message: "Slot invalide" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "Aucun fichier reçu" });
  }

  try {
    const dir = path.join(UPLOAD_ROOT, uid);
    fs.mkdirSync(dir, { recursive: true });

    // Normalize orientation once (EXIF-aware), reuse the decoded buffer for
    // every variant instead of re-reading/re-rotating the source each time.
    const normalized = await sharp(req.file.path).rotate().toBuffer();
    const cacheBust = Date.now();
    const urls = {};

    await Promise.all(
      VARIANTS.map(async ({ key, suffix, maxWidth, quality }) => {
        const filename = `photo-${slot}${suffix}.jpg`;
        await sharp(normalized)
          .resize({ width: maxWidth, withoutEnlargement: true }) // ratio preserved, never cropped
          .jpeg({ quality, mozjpeg: true })
          .toFile(path.join(dir, filename));
        urls[key] = `${FRONTEND_URL}/uploads/profile-photos/${uid}/${filename}?v=${cacheBust}`;
      }),
    );

    fs.unlink(req.file.path, () => {});

    // `url` kept for backward compatibility with existing frontend calls
    // that only expect a single string; `urls` exposes all three sizes.
    res.json({ url: urls.full, urls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible d'enregistrer la photo" });
  }
}

module.exports = { uploadPhoto };
