const fs = require("fs");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { photoFile, recordCheck, auditProfile } = require("../services/profilePhotoAudit");
const { refusedFile } = require("../services/photoReviews");
const { PHOTO_REASONS, reasonFor } = require("../services/photoDecision");
const { storePhotoVariants } = require("./photoController");
const { sendPushToUser } = require("../services/pushService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// The photo moderation queue (services/photoReviews.js), for moderators,
// admins and super admins — mounted at /api/admin/photo-reviews.

const STATUSES = ["pending", "approved", "rejected"];
const MAX_PHOTOS = 3;

function toMillis(v) {
    return v?.toMillis?.() ?? null;
}

// GET /api/admin/photo-reviews?status=pending → { reviews, reasons }
// Contested photos first, then the oldest (waiting longest).
async function listPhotoReviews(req, res) {
    const status = STATUSES.includes(req.query.status) ? req.query.status : "pending";
    try {
        const snap = await db.collection("photoReviews").where("status", "==", status).limit(200).get();
        const reviews = snap.docs
            .map((d) => {
                const r = d.data();
                return {
                    id: d.id,
                    uid: r.uid,
                    firstName: r.firstName,
                    source: r.source,
                    onProfile: !!r.url,
                    code: r.code,
                    reason: r.code ? reasonFor(r.code) : null,
                    details: r.details || {},
                    appealed: !!r.appealed,
                    createdAt: toMillis(r.createdAt),
                    decidedAt: toMillis(r.decidedAt),
                    decisionCode: r.decisionCode || null,
                };
            })
            .sort((a, b) =>
                status === "pending"
                    ? Number(b.appealed) - Number(a.appealed) || (a.createdAt || 0) - (b.createdAt || 0)
                    : (b.decidedAt || 0) - (a.decidedAt || 0),
            );
        res.json({ reviews, reasons: PHOTO_REASONS });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de charger les photos à vérifier" });
    }
}

function reviewFile(review) {
    return review.url ? photoFile(review.uid, review.url) : refusedFile(review.uid, review.refusalId || "");
}

// GET /api/admin/photo-reviews/:id/image
async function getPhotoReviewImage(req, res) {
    try {
        const review = (await db.collection("photoReviews").doc(req.params.id).get()).data();
        const file = review && reviewFile(review);
        if (!file || !fs.existsSync(file)) return res.status(404).json({ message: "Photo introuvable" });
        res.set("Cache-Control", "private, no-store");
        res.sendFile(file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Photo introuvable" });
    }
}

// A refused upload a moderator validated: added to the profile — in a free
// place, or instead of a refused photo. → the new url, or null when the
// profile already has 3 good photos.
async function addToProfile(review) {
    const profileRef = db.collection("profiles").doc(review.uid);
    const profile = (await profileRef.get()).data() || {};
    const photos = [...(profile.photos || [])];
    const checks = (await db.collection("photoChecks").doc(review.uid).get()).data()?.results || {};
    const used = new Set(photos.map((u) => (u.match(/\/photo-(\d+)\.jpg/) || [])[1]).filter(Boolean).map(Number));

    let index = photos.length < MAX_PHOTOS ? photos.length : photos.findIndex((u) => checks[u]?.verdict === "rejected");
    if (index < 0) return null;
    // The file slot: the replaced photo's, or one no current photo uses.
    const replacedSlot = index < photos.length ? Number((photos[index].match(/\/photo-(\d+)\.jpg/) || [])[1]) : null;
    const slot = Number.isInteger(replacedSlot) ? replacedSlot : [0, 1, 2].find((s) => !used.has(s));
    if (slot == null) return null;

    const image = await sharp(refusedFile(review.uid, review.refusalId)).toBuffer();
    const urls = await storePhotoVariants(review.uid, slot, image);
    photos[index] = urls.full;
    await profileRef.set({ photos, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return urls.full;
}

// PATCH /api/admin/photo-reviews/:id { decision: 'approve' | 'reject', code? }
async function decidePhotoReview(req, res) {
    const { decision, code } = req.body || {};
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: "Décision invalide" });
    if (decision === "reject" && code && !PHOTO_REASONS[code]) return res.status(400).json({ message: "Motif invalide" });
    const ref = db.collection("photoReviews").doc(req.params.id);
    try {
        const review = (await ref.get()).data();
        if (!review) return res.status(404).json({ message: "Demande introuvable" });
        if (review.status !== "pending") return res.status(409).json({ message: "Cette photo a déjà été traitée." });
        const finalCode = decision === "reject" ? code || review.code || "photo-no-face" : null;

        let added = null;
        if (decision === "approve") {
            if (review.url) await recordCheck(review.uid, review.url, { verdict: "accepted", code: null, human: true });
            else added = await addToProfile(review);
            if (added) await recordCheck(review.uid, added, { verdict: "accepted", code: null, human: true });
        } else if (review.url) {
            await recordCheck(review.uid, review.url, { verdict: "rejected", code: finalCode, human: true });
        }

        await ref.update({
            status: decision === "approve" ? "approved" : "rejected",
            decisionCode: finalCode,
            decidedAt: FieldValue.serverTimestamp(),
            decidedBy: req.firebaseUser.uid,
            ...(added ? { url: added } : {}),
        });

        // The verdict changes the account's state (a suspension can be lifted, or confirmed).
        const profile = (await db.collection("profiles").doc(review.uid).get()).data();
        if (profile) await auditProfile(review.uid, profile);

        const fullProfile = decision === "approve" && !review.url && !added;
        sendPushToUser(review.uid, {
            title: decision === "approve" ? "Ta photo a été validée ✅" : "Ta photo n'a pas été validée",
            body:
                decision === "approve"
                    ? fullProfile
                        ? "L'équipe l'a validée, mais ton profil a déjà 3 photos : retires-en une puis ajoute-la à nouveau."
                        : "L'équipe a vérifié ta photo : elle est bien sur ton profil."
                    : reasonFor(finalCode),
            path: "/profile",
        }).catch(() => {});
        res.json({ ok: true, added: !!added });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la décision" });
    }
}

module.exports = { listPhotoReviews, getPhotoReviewImage, decidePhotoReview };
