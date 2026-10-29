const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { MIN_PHOTO_SIDE, MIN_PROFILE_PHOTOS, PHOTO_DEADLINE_MS, isHdOriginal } = require("../config/photoQuality");
const { auditProfile, recordCheck } = require("../services/profilePhotoAudit");
const { analyzeProfilePhoto } = require("../services/photoAnalysis");
const { reasonFor } = require("../services/photoDecision");
const { appealRefusedUpload, keepRefusedUpload, logDecision, queuePhotoReview } = require("../services/photoReviews");

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

// Writes the three variants of a photo in a slot → { full, medium, thumb } urls.
async function storePhotoVariants(uid, slot, normalized) {
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
  return urls;
}

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

    // A real photo of a person (services/photoAnalysis.js, decided by
    // photoDecision.js): accepted, accepted pending a moderator's look, or
    // refused. If the analysis itself breaks, the photo goes through: a bug
    // must never block signups — it's logged instead.
    let analysis = null;
    try {
      analysis = await analyzeProfilePhoto(normalized);
      logDecision({ uid, source: "upload", analysis });
    } catch (err) {
      console.error("Analyse photo indisponible :", err);
    }
    if (analysis?.verdict === "rejected") {
      fs.unlink(req.file.path, () => {});
      // Kept privately: the member can ask a moderator to look at it.
      const refusalId = await keepRefusedUpload({ uid, image: normalized, slot, code: analysis.code, details: analysis.details }).catch((err) => {
        console.error("Photo refusée non conservée :", err.message);
        return null;
      });
      return res.status(422).json({ code: analysis.code, message: reasonFor(analysis.code), refusalId });
    }

    const urls = await storePhotoVariants(uid, slot, normalized);
    fs.unlink(req.file.path, () => {});

    const review = analysis?.verdict === "review";
    if (analysis) {
      await recordCheck(uid, urls.full, { verdict: analysis.verdict, code: analysis.code || null, human: false });
      if (review) await queuePhotoReview({ uid, url: urls.full, source: "upload", code: analysis.code, details: analysis.details });
    }

    // `url` kept for backward compatibility with existing frontend calls
    // that only expect a single string; `urls` exposes all three sizes.
    // review: accepted for now, a moderator will have a look.
    res.json({ url: urls.full, urls, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible d'enregistrer la photo" });
  }
}

// POST /api/photos/appeal { refusalId, slot } | { url }
// "Ce n'est pas correct, demander une vérification": a refused upload
// (refusalId) or a refused photo of the profile (url) goes to a moderator.
async function appealPhoto(req, res) {
  const uid = req.firebaseUser.uid;
  const { refusalId, url, slot } = req.body || {};
  try {
    if (typeof refusalId === "string") {
      const ok = await appealRefusedUpload(uid, refusalId, Number(slot));
      if (!ok) return res.status(404).json({ message: "Cette photo n'est plus disponible : ajoute-la à nouveau." });
      return res.json({ ok: true });
    }
    if (typeof url === "string") {
      const profile = (await admin.firestore().collection("profiles").doc(uid).get()).data() || {};
      if (!(profile.photos || []).includes(url)) return res.status(404).json({ message: "Cette photo n'est plus sur ton profil." });
      const check = (await admin.firestore().collection("photoChecks").doc(uid).get()).data()?.results?.[url];
      if (check?.human) return res.status(409).json({ message: "L'équipe a déjà vérifié cette photo." });
      await queuePhotoReview({ uid, url, source: "audit", code: check?.code || null, appealed: true });
      return res.json({ ok: true });
    }
    res.status(400).json({ message: "Photo manquante" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible d'envoyer la demande, réessaie." });
  }
}

// GET /api/photos/quality — what's wrong with the member's current profile
// photos (services/profilePhotoAudit.js): not HD, refused (by the analysis,
// waiting for a moderator, or by a moderator), being checked, or too few;
// with whether the account is suspended.
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
      review: audit.review,
      missing: audit.missing,
      suspended: audit.suspended,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible de vérifier les photos" });
  }
}

module.exports = { uploadPhoto, photoQuality, appealPhoto, storePhotoVariants };
