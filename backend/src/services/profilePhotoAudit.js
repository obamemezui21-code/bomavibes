const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { MIN_PROFILE_PHOTOS, PHOTO_DEADLINE_MS, isHdStored } = require("../config/photoQuality");
const { analyzeProfilePhoto, REJECTION_MESSAGES } = require("./photoAnalysis");
const { sendPushToUser } = require("./pushService");

const db = admin.firestore();

// Profile photos must be HD, real photos of the member (face visible — the
// same analysis as on upload, services/photoAnalysis.js), and at least
// MIN_PROFILE_PHOTOS of them. New uploads are checked on the way in; this
// audits the photos already on profiles (many predate those checks).
//
//   photoChecks/{uid}        results { [photo url]: { ok, code } } — so a photo
//                            is analysed once, not on every visit
//   profiles/{uid}.photoStatus { ok, checkedAt, notifiedAt } — written here only
//                            (firestore.rules); after PHOTO_DEADLINE_MS an
//                            account with ok === false is suspended: hidden
//                            from Discover, no likes, the app opens only the
//                            profile page until the photos are fixed.

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
const STORED_PHOTO = /\/uploads\/profile-photos\/([^/]+)\/(photo-\d+\.jpg)(?:\?|$)/;
const SYSTEM_ACCOUNT_ID = "bomavibes-team";
const AUDIT_EVERY_MS = 6 * 60 * 60 * 1000;

const NOT_OURS_MESSAGE = "Cette photo ne vient pas de BomaVibes : remplace-la par une photo de toi prise avec ton téléphone.";
const NOT_HD_MESSAGE = "Photo trop petite (pas en HD) : remplace-la par une photo prise avec ton téléphone.";

function photoFile(uid, url) {
  const match = typeof url === "string" && url.match(STORED_PHOTO);
  if (!match || match[1] !== uid) return null;
  return path.join(UPLOAD_ROOT, uid, match[2]);
}

/**
 * Checks a member's current profile photos.
 * @returns {Promise<{ ok: boolean, lowRes: string[], rejected: { url: string, code: string, message: string }[], missing: number }>}
 *   lowRes: not HD; rejected: not a real photo of the member (or not one of ours); missing: photos still to add
 */
async function auditPhotos(uid, photos = []) {
  const checksRef = db.collection("photoChecks").doc(uid);
  const cached = (await checksRef.get()).data()?.results || {};
  const results = {};
  const lowRes = [];
  const rejected = [];

  for (const url of photos) {
    const file = photoFile(uid, url);
    if (!file) {
      rejected.push({ url, code: "photo-not-ours", message: NOT_OURS_MESSAGE });
      continue;
    }
    let image;
    try {
      const { width, height } = await sharp(file).metadata();
      if (!width || !height || !isHdStored(width, height)) lowRes.push(url);
      image = file;
    } catch {
      // The file is gone: the photo has to be replaced.
      rejected.push({ url, code: "photo-not-ours", message: NOT_OURS_MESSAGE });
      continue;
    }
    let result = cached[url];
    if (!result) {
      try {
        const analysis = await analyzeProfilePhoto(await sharp(image).rotate().toBuffer());
        result = analysis.ok ? { ok: true } : { ok: false, code: analysis.code };
      } catch (err) {
        // The analysis is unavailable (models missing…): never suspend anyone
        // over an outage — the photo counts as fine and is checked again later.
        console.error("Audit photo indisponible :", err.message);
        continue;
      }
    }
    results[url] = result;
    if (!result.ok) rejected.push({ url, code: result.code, message: REJECTION_MESSAGES[result.code] || NOT_OURS_MESSAGE });
  }

  // Keep only the current photos' results.
  const changed = Object.keys(results).length !== Object.keys(cached).length || Object.keys(results).some((u) => !cached[u]);
  if (changed) await checksRef.set({ results, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  const missing = Math.max(0, MIN_PROFILE_PHOTOS - photos.length);
  return { ok: lowRes.length === 0 && rejected.length === 0 && missing === 0, lowRes, rejected, missing };
}

// Audits one member and records the outcome on the profile; warns them once
// (push) when their photos must be fixed. → the audit
async function auditProfile(uid, profile) {
  const audit = await auditPhotos(uid, profile?.photos || []);
  const previous = profile?.photoStatus || {};
  const update = { ok: audit.ok, checkedAt: Date.now(), notifiedAt: audit.ok ? null : previous.notifiedAt || null };
  if (!audit.ok && !previous.notifiedAt) {
    const late = Date.now() > PHOTO_DEADLINE_MS;
    sendPushToUser(uid, {
      title: late ? "Ton compte est suspendu 📷" : "Mets de vraies photos de toi 📷",
      body: late
        ? "Ajoute de vraies photos de toi, visage visible, pour réactiver ton compte."
        : "Il faut au moins 2 vraies photos de toi, visage visible, avant le 21 octobre. Sinon ton compte sera suspendu.",
      path: "/profile",
    }).catch(() => {});
    update.notifiedAt = Date.now();
  }
  if (previous.ok !== update.ok || previous.notifiedAt !== update.notifiedAt || !previous.checkedAt) {
    await db.collection("profiles").doc(uid).set({ photoStatus: update }, { merge: true });
  }
  return audit;
}

// Whether a profile is suspended for its photos right now.
function photosSuspended(profile, now = Date.now()) {
  return profile?.photoStatus?.ok === false && now > PHOTO_DEADLINE_MS;
}

// Every member, every few hours, so those who never open the app are
// covered too (and hidden once the deadline has passed).
async function auditAllProfiles() {
  let last = null;
  let audited = 0;
  let failing = 0;
  for (;;) {
    let q = db.collection("profiles").orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      if (doc.id === SYSTEM_ACCOUNT_ID) continue;
      try {
        const audit = await auditProfile(doc.id, doc.data());
        audited++;
        if (!audit.ok) failing++;
      } catch (err) {
        console.error(`Audit photos ${doc.id} :`, err.message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
  }
  console.log(`Audit photos : ${audited} profils, ${failing} à corriger`);
}

function startPhotoAuditScheduler() {
  const run = () => auditAllProfiles().catch((err) => console.error("Audit photos :", err));
  setTimeout(run, 60 * 1000);
  setInterval(run, AUDIT_EVERY_MS);
}

module.exports = { auditPhotos, auditProfile, photosSuspended, startPhotoAuditScheduler };
