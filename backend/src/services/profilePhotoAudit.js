const path = require("path");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { MIN_PROFILE_PHOTOS, PHOTO_DEADLINE_MS, isHdStored } = require("../config/photoQuality");
const { analyzeProfilePhoto } = require("./photoAnalysis");
const { photosSuspension, reasonFor } = require("./photoDecision");
const { logDecision, queuePhotoReview, pruneRefusedUploads } = require("./photoReviews");
const { sendPushToUser } = require("./pushService");

const db = admin.firestore();

// Profile photos should be HD, real photos of the member (face visible — the
// same analysis as on upload, services/photoAnalysis.js), and at least
// MIN_PROFILE_PHOTOS of them. New uploads are checked on the way in; this
// audits the photos already on profiles (many predate those checks).
//
//   photoChecks/{uid}   results { [photo url]: { v, verdict, code, human } }
//                       — a photo is analysed once, not on every visit;
//                       human: decided by a moderator (never re-analysed).
//                       Results from before v2 (the stricter analysis) are
//                       analysed again.
//   profiles/{uid}.photoStatus { ok, suspended, checkedAt, notifiedAt } —
//                       written here only (firestore.rules). ok: nothing to
//                       fix; suspended (services/photoDecision.js
//                       photosSuspension): hidden from Discover, no likes, the
//                       app opens only the profile page.
//
// Photos the analysis isn't sure about, or refuses, go to the moderation
// queue (services/photoReviews.js): an account is never suspended over an
// automatic refusal alone.

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
const STORED_PHOTO = /\/uploads\/profile-photos\/([^/]+)\/(photo-\d+\.jpg)(?:\?|$)/;
const SYSTEM_ACCOUNT_ID = "bomavibes-team";
const AUDIT_EVERY_MS = 6 * 60 * 60 * 1000;
const CHECK_VERSION = 2;

function photoFile(uid, url) {
  const match = typeof url === "string" && url.match(STORED_PHOTO);
  if (!match || match[1] !== uid) return null;
  return path.join(UPLOAD_ROOT, uid, match[2]);
}

// Records a decision for one photo (upload or moderator).
async function recordCheck(uid, url, result) {
  await db
    .collection("photoChecks")
    .doc(uid)
    .set({ results: { [url]: { v: CHECK_VERSION, ...result } }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Checks a member's current profile photos.
 * @returns {Promise<{ ok: boolean, suspended: boolean, lowRes: string[], review: string[],
 *   rejected: { url: string, code: string, message: string, human: boolean }[], missing: number }>}
 *   lowRes: not HD (to improve, never a suspension on its own); review: accepted
 *   for now, a moderator will look; rejected: refused — by the analysis
 *   (human: false, waiting for a moderator) or by a moderator (human: true);
 *   missing: photos still to add
 */
async function auditPhotos(uid, photos = []) {
  const checksRef = db.collection("photoChecks").doc(uid);
  const cached = (await checksRef.get()).data()?.results || {};
  const results = {};
  const states = [];
  const lowRes = [];
  const review = [];
  const rejected = [];

  for (const url of photos) {
    const file = photoFile(uid, url);
    let image = null;
    if (file) {
      try {
        const { width, height } = await sharp(file).metadata();
        if (!width || !height || !isHdStored(width, height)) lowRes.push(url);
        image = file;
      } catch {
        // The file is gone: the photo has to be replaced.
      }
    }
    if (!image) {
      states.push("not-ours");
      rejected.push({ url, code: "photo-not-ours", message: reasonFor("photo-not-ours"), human: false });
      continue;
    }

    let result = cached[url]?.v === CHECK_VERSION ? cached[url] : null;
    if (!result) {
      try {
        const analysis = await analyzeProfilePhoto(await sharp(image).rotate().toBuffer());
        logDecision({ uid, source: "audit", url, analysis });
        result = { v: CHECK_VERSION, verdict: analysis.verdict, code: analysis.code || null, human: false };
        if (analysis.verdict !== "accepted") {
          await queuePhotoReview({ uid, url, source: "audit", code: analysis.code, details: analysis.details });
        }
      } catch (err) {
        // The analysis is unavailable (models missing…): never suspend anyone
        // over an outage — the photo counts as fine and is checked again later.
        console.error("Audit photo indisponible :", err.message);
        states.push("accepted");
        continue;
      }
    }
    results[url] = result;
    if (result.verdict === "accepted") states.push("accepted");
    else if (result.verdict === "review") {
      states.push("review");
      review.push(url);
    } else {
      states.push(result.human ? "rejected" : "pending");
      rejected.push({ url, code: result.code, message: reasonFor(result.code), human: !!result.human });
    }
  }

  // Keep only the current photos' results.
  const changed = Object.keys(results).length !== Object.keys(cached).length || Object.keys(results).some((u) => cached[u] !== results[u]);
  if (changed) await checksRef.set({ results, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  const missing = Math.max(0, MIN_PROFILE_PHOTOS - photos.length);
  return {
    ok: lowRes.length === 0 && rejected.length === 0 && missing === 0,
    suspended: photosSuspension(states, { deadline: PHOTO_DEADLINE_MS }),
    lowRes,
    review,
    rejected,
    missing,
  };
}

// Audits one member and records the outcome on the profile; warns them
// (push) when their photos must be fixed, and again if the account ends up
// suspended. → the audit
async function auditProfile(uid, profile) {
  const audit = await auditPhotos(uid, profile?.photos || []);
  const previous = profile?.photoStatus || {};
  const update = {
    ok: audit.ok,
    suspended: audit.suspended,
    checkedAt: Date.now(),
    notifiedAt: audit.ok ? null : previous.notifiedAt || null,
  };
  const newlySuspended = audit.suspended && previous.suspended !== true;
  if ((!audit.ok && !previous.notifiedAt) || newlySuspended) {
    sendPushToUser(uid, {
      title: audit.suspended ? "Ton compte est suspendu 📷" : "Une de tes photos est à revoir 📷",
      body: audit.suspended
        ? "Après vérification par l'équipe, tes photos ne te montrent pas : ajoute une vraie photo de toi pour réactiver ton compte."
        : "Ouvre ton profil pour voir ce qui ne va pas et comment la corriger.",
      path: "/profile",
    }).catch(() => {});
    update.notifiedAt = Date.now();
  }
  if (previous.ok !== update.ok || previous.suspended !== update.suspended || previous.notifiedAt !== update.notifiedAt || !previous.checkedAt) {
    await db.collection("profiles").doc(uid).set({ photoStatus: update }, { merge: true });
  }
  return audit;
}

// Whether a profile is suspended for its photos right now. Statuses written
// before the softer rules (no "suspended" field) don't suspend anyone.
function photosSuspended(profile) {
  return profile?.photoStatus?.suspended === true;
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
  const run = () => {
    auditAllProfiles().catch((err) => console.error("Audit photos :", err));
    try {
      pruneRefusedUploads();
    } catch (err) {
      console.error("Nettoyage des photos refusées :", err.message);
    }
  };
  setTimeout(run, 60 * 1000);
  setInterval(run, AUDIT_EVERY_MS);
}

module.exports = { CHECK_VERSION, photoFile, recordCheck, auditPhotos, auditProfile, photosSuspended, startPhotoAuditScheduler };
