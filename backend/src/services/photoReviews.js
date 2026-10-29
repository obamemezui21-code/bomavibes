const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { THRESHOLDS } = require("./photoDecision");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// The human side of the photo checks (services/photoDecision.js).
//
// Firestore (Admin SDK only — no client rule opens them):
//   photoReviews/{id}    one photo for the moderation queue:
//       uid, firstName, source ('upload' | 'audit' | 'upload-refused'),
//       url (a photo on the profile) or refusalId (a refused upload kept
//       privately, see quarantine), slot, code, details (the scores),
//       appealed (the member asked for it), status ('pending' | 'approved' |
//       'rejected' | 'refused': a refused upload nobody contested),
//       createdAt, decidedAt, decidedBy, decisionCode
//   photoDecisions/{id}  every automatic decision with its measures, to tune
//       the thresholds: uid, source, url, verdict, code, details, thresholds, at
//
// Refused uploads are kept 30 days in backend/private/photo-reviews/{uid}/
// (never served publicly) so their owner can ask a human to look at them.

const REVIEW_DIR = path.join(__dirname, "..", "..", "private", "photo-reviews");
const KEEP_REFUSED_MS = 30 * 24 * 60 * 60 * 1000;

function refusedFile(uid, refusalId) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[a-f0-9]{24}$/.test(refusalId)) return null;
    return path.join(REVIEW_DIR, uid, `${refusalId}.jpg`);
}

// Records an automatic decision (never blocks the caller).
function logDecision({ uid, source, url = null, analysis }) {
    const { verdict, code, details } = analysis;
    console.log(`Photo ${source} ${uid} : ${verdict}${code ? ` (${code})` : ""} ${JSON.stringify(details)}`);
    db.collection("photoDecisions")
        .add({ uid, source, url, verdict, code: code || null, details, thresholds: THRESHOLDS, at: FieldValue.serverTimestamp() })
        .catch((err) => console.error("Journal des décisions photo :", err.message));
}

async function firstNameOf(uid) {
    return (await db.collection("profiles").doc(uid).get()).data()?.firstName || "Membre";
}

/**
 * Puts a profile photo in the moderation queue (once: an existing pending
 * review of the same photo is reused, and marked as contested if `appealed`).
 * @returns {Promise<string>} the review id
 */
async function queuePhotoReview({ uid, url, source, code, details = {}, appealed = false }) {
    const pending = await db.collection("photoReviews").where("uid", "==", uid).where("url", "==", url).where("status", "==", "pending").limit(1).get();
    if (!pending.empty) {
        const ref = pending.docs[0].ref;
        if (appealed && !pending.docs[0].data().appealed) await ref.update({ appealed: true, appealedAt: FieldValue.serverTimestamp() });
        return ref.id;
    }
    const ref = await db.collection("photoReviews").add({
        uid,
        firstName: await firstNameOf(uid),
        source,
        url,
        refusalId: null,
        slot: null,
        code: code || null,
        details,
        appealed,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
}

/**
 * Keeps a refused upload privately, so its owner can contest the refusal.
 * @returns {Promise<string>} refusalId
 */
async function keepRefusedUpload({ uid, image, slot, code, details }) {
    const refusalId = crypto.randomBytes(12).toString("hex");
    const dir = path.join(REVIEW_DIR, uid);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(image).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(refusedFile(uid, refusalId));
    await db.collection("photoReviews").doc(refusalId).set({
        uid,
        firstName: await firstNameOf(uid),
        source: "upload-refused",
        url: null,
        refusalId,
        slot,
        code,
        details,
        appealed: false,
        status: "refused",
        createdAt: FieldValue.serverTimestamp(),
    });
    return refusalId;
}

// The member contests a refused upload: it joins the moderation queue.
async function appealRefusedUpload(uid, refusalId, slot) {
    const file = refusedFile(uid, refusalId);
    const ref = db.collection("photoReviews").doc(refusalId);
    const review = (await ref.get()).data();
    if (!file || !review || review.uid !== uid || !fs.existsSync(file)) return false;
    if (review.status === "refused") {
        await ref.update({ status: "pending", appealed: true, appealedAt: FieldValue.serverTimestamp(), slot: [0, 1, 2].includes(slot) ? slot : review.slot });
    }
    return true;
}

// Refused uploads older than 30 days and never contested: deleted.
function pruneRefusedUploads(now = Date.now()) {
    if (!fs.existsSync(REVIEW_DIR)) return;
    for (const uid of fs.readdirSync(REVIEW_DIR)) {
        const dir = path.join(REVIEW_DIR, uid);
        for (const name of fs.readdirSync(dir)) {
            const file = path.join(dir, name);
            if (now - fs.statSync(file).mtimeMs > KEEP_REFUSED_MS) {
                const id = name.replace(/\.jpg$/, "");
                db.collection("photoReviews")
                    .doc(id)
                    .get()
                    .then((snap) => {
                        if (snap.data()?.status !== "pending") fs.unlink(file, () => {});
                    })
                    .catch(() => {});
            }
        }
    }
}

module.exports = { REVIEW_DIR, refusedFile, logDecision, queuePhotoReview, keepRefusedUpload, appealRefusedUpload, pruneRefusedUploads };
