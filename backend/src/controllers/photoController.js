const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { MIN_PHOTO_SIDE, MIN_PROFILE_PHOTOS, PHOTO_DEADLINE_MS, isHdOriginal } = require("../config/photoQuality");
const { auditProfile } = require("../services/profilePhotoAudit");
const { analyzeProfilePhoto, REJECTION_MESSAGES } = require("../services/photoAnalysis");

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
    // HD photos only (see config/photoQuality.js).
    const { width, height } = await sharp(req.file.path).metadata();
    if (!width || !height || !isHdOriginal(width, height)) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        code: "photo-not-hd",
        message: `Photo trop petite : il faut une photo HD d'au moins ${MIN_PHOTO_SIDE} pixels de côté. Prends-en une nouvelle avec ton téléphone plutôt qu'une capture d'écran ou une image reçue sur WhatsApp.`,
      });
    }

    // Normalize orientation once (EXIF-aware), reuse the decoded buffer for
    // the analysis and every variant instead of re-reading the source.
    const normalized = await sharp(req.file.path).rotate().toBuffer();

    // A real photo of a person (see services/photoAnalysis.js). If the
    // analysis itself breaks, the photo goes through: a bug must never
    // block signups — it's logged instead.
    let analysis = null;
    try {
      analysis = await analyzeProfilePhoto(normalized);
    } catch (err) {
      console.error("Analyse photo indisponible :", err);
    }
    if (analysis && !analysis.ok) {
      fs.unlink(req.file.path, () => {});
      console.log(`Photo refusée (${uid}, ${analysis.code}) ${JSON.stringify(analysis.details)}`);
      return res.status(422).json({ code: analysis.code, message: REJECTION_MESSAGES[analysis.code] });
    }

    const dir = path.join(UPLOAD_ROOT, uid);
    fs.mkdirSync(dir, { recursive: true });
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

// GET /api/photos/quality — what's wrong with the member's current profile
// photos (services/profilePhotoAudit.js): not HD, not a real photo of them,
// or too few; with the deadline after which the account is suspended.
async function photoQuality(req, res) {
  const uid = req.firebaseUser.uid;
  try {
    const snap = await admin.firestore().collection("profiles").doc(uid).get();
    const audit = await auditProfile(uid, snap.exists ? snap.data() : {});
    res.json({
      minSide: MIN_PHOTO_SIDE,
      minPhotos: MIN_PROFILE_PHOTOS,
      deadline: PHOTO_DEADLINE_MS,
      lowRes: audit.lowRes,
      rejected: audit.rejected,
      missing: audit.missing,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible de vérifier les photos" });
  }
}

module.exports = { uploadPhoto, photoQuality };
