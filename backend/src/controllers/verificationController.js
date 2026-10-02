const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { logAdminAction } = require("../services/adminLogService");
const { VERIFICATION_BONUS } = require("../config/ngori");

const db = admin.firestore();

// Identity verification (the "Profil vérifié" badge — mandatory for
// accounts created since it became required, see identityMigration.js).
//
// 1. The user asks to start: the SERVER picks a random pose, so a selfie
//    can't be an old photo prepared in advance.
// 2. The user sends a photo of an identity document + a selfie doing that
//    pose → request goes "pending".
// 3. A moderator checks the document (real, readable, 18+), that the selfie
//    matches it and the profile photos, then approves (sets
//    profiles/{uid}.verified — only the Admin SDK can) or rejects it.
//
// verificationRequests/{uid}: { status, pose, poseAssignedAt, submittedAt,
//   idType, reviewedAt, reviewedBy, rejectReason }
// status: awaiting_selfie → pending → approved | rejected
//
// Selfies and identity documents are PRIVATE: stored outside the public
// uploads folder, only streamed to moderators, and deleted as soon as a
// decision is made (only "verified on … with a …" is kept).
const SELFIE_DIR = path.join(__dirname, "..", "..", "private", "verification-selfies");
const ID_DIR = path.join(__dirname, "..", "..", "private", "verification-ids");

const ID_TYPES = {
    cni: "Carte d'identité",
    passport: "Passeport",
    permis: "Permis de conduire",
    sejour: "Titre de séjour",
};
const POSE_VALID_MS = 30 * 60 * 1000;

const POSES = {
    "thumbs-up": "Levez le pouce 👍 à côté de votre visage",
    peace: "Faites un V avec deux doigts ✌️ à côté de votre visage",
    "open-hand": "Montrez votre main ouverte ✋ à côté de votre visage",
    "point-cheek": "Pointez votre joue avec l'index ☝️",
    ok: "Faites le signe OK 👌 à côté de votre visage",
};

const REJECT_REASONS = {
    blurry: "La photo est floue ou trop sombre.",
    pose: "La pose demandée n'est pas visible.",
    mismatch: "Le selfie ne correspond pas aux photos du profil.",
    face: "Le visage n'est pas bien visible.",
    id_unreadable: "La pièce d'identité est illisible ou incomplète.",
    id_mismatch: "Le selfie ne correspond pas à la photo de la pièce d'identité.",
    id_invalid: "La pièce d'identité n'est pas valide (expirée, modifiée ou non acceptée).",
    underage: "BomaVibes est réservé aux personnes majeures (18 ans et plus).",
    id_missing: "Une photo de votre pièce d'identité est nécessaire.",
    other: "La vérification n'a pas pu être validée.",
};

function selfiePath(uid) {
    // uids are Firebase ids (alphanumeric), never user input paths — but
    // strip anything else anyway before touching the filesystem.
    return path.join(SELFIE_DIR, `${String(uid).replace(/[^A-Za-z0-9_-]/g, "")}.jpg`);
}

function idPath(uid) {
    return path.join(ID_DIR, `${String(uid).replace(/[^A-Za-z0-9_-]/g, "")}.jpg`);
}

// Selfie and identity document both go once a decision is made (and when
// the account is deleted).
function removeVerificationFiles(uid) {
    fs.unlink(selfiePath(uid), () => {});
    fs.unlink(idPath(uid), () => {});
}

// Re-encode: fixes orientation, caps the size and drops EXIF (location
// etc.) — sharp doesn't copy metadata unless asked.
async function storePrivateImage(tmpPath, dest, maxSide) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(tmpPath)
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(dest);
}

// POST /api/verification/start
async function startVerification(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const profileSnap = await db.collection("profiles").doc(uid).get();
        if (profileSnap.data()?.verified) {
            return res.status(409).json({ message: "Votre profil est déjà vérifié." });
        }
        if (!(profileSnap.data()?.photos || []).length) {
            return res.status(400).json({ message: "Ajoutez d'abord au moins une photo de profil." });
        }
        const current = (await db.collection("verificationRequests").doc(uid).get()).data();
        if (current?.status === "pending") {
            return res.status(409).json({ message: "Une demande est déjà en cours d'examen." });
        }

        const poseIds = Object.keys(POSES);
        const pose = poseIds[crypto.randomInt(poseIds.length)];
        await db.collection("verificationRequests").doc(uid).set({
            uid,
            status: "awaiting_selfie",
            pose,
            poseAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
            rejectReason: null,
        });
        res.json({ pose, instruction: POSES[pose] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de démarrer la vérification" });
    }
}

// POST /api/verification/submit (multipart "document" + "selfie", field idType)
async function submitVerification(req, res) {
    const uid = req.firebaseUser.uid;
    const document = req.files?.document?.[0];
    const selfie = req.files?.selfie?.[0];
    const cleanup = () => [document, selfie].forEach((f) => f && fs.unlink(f.path, () => {}));
    const idType = req.body?.idType;

    if (!document || !selfie) {
        cleanup();
        return res.status(400).json({ message: "Envoyez la photo de votre pièce d'identité et votre selfie." });
    }
    if (!ID_TYPES[idType]) {
        cleanup();
        return res.status(400).json({ message: "Type de pièce d'identité invalide." });
    }

    try {
        const ref = db.collection("verificationRequests").doc(uid);
        const request = (await ref.get()).data();
        const assignedAt = request?.poseAssignedAt?.toMillis?.() || 0;
        if (request?.status !== "awaiting_selfie" || Date.now() - assignedAt > POSE_VALID_MS) {
            cleanup();
            return res.status(409).json({ message: "La pose a expiré, recommencez la vérification." });
        }

        await storePrivateImage(document.path, idPath(uid), 1600);
        await storePrivateImage(selfie.path, selfiePath(uid), 1080);
        cleanup();

        await ref.update({ status: "pending", idType, submittedAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ status: "pending" });
    } catch (err) {
        console.error(err);
        cleanup();
        removeVerificationFiles(uid);
        res.status(500).json({ message: "Impossible d'envoyer les photos" });
    }
}

// GET /api/admin/verifications?status=pending
async function listVerifications(req, res) {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
    try {
        const snap = await db.collection("verificationRequests").where("status", "==", status).limit(100).get();
        const requests = await Promise.all(
            snap.docs.map(async (d) => {
                const data = d.data();
                const profile = (await db.collection("profiles").doc(d.id).get()).data() || {};
                return {
                    uid: d.id,
                    status: data.status,
                    pose: data.pose,
                    instruction: POSES[data.pose] || null,
                    submittedAt: data.submittedAt?.toMillis?.() || null,
                    reviewedAt: data.reviewedAt?.toMillis?.() || null,
                    rejectReason: data.rejectReason || null,
                    hasSelfie: fs.existsSync(selfiePath(d.id)),
                    hasIdDocument: fs.existsSync(idPath(d.id)),
                    idType: data.idType || null,
                    idTypeLabel: ID_TYPES[data.idType] || null,
                    profile: {
                        firstName: profile.firstName || "",
                        age: profile.age || null,
                        city: profile.city || null,
                        photos: profile.photos || [],
                    },
                };
            }),
        );
        requests.sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
        res.json({ requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de charger les demandes" });
    }
}

// GET /api/admin/verifications/:uid/selfie — moderators only
function getSelfie(req, res) {
    const file = selfiePath(req.params.uid);
    if (!fs.existsSync(file)) return res.status(404).json({ message: "Selfie introuvable" });
    res.set("Cache-Control", "private, no-store");
    res.sendFile(file);
}

// GET /api/admin/verifications/:uid/id-document — moderators only
function getIdDocument(req, res) {
    const file = idPath(req.params.uid);
    if (!fs.existsSync(file)) return res.status(404).json({ message: "Pièce d'identité introuvable" });
    res.set("Cache-Control", "private, no-store");
    res.sendFile(file);
}

async function notifyUser(uid, title, body) {
    try {
        const tokens = (await db.collection("users").doc(uid).get()).data()?.fcmTokens || [];
        if (!tokens.length) return;
        await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body },
            webpush: { fcmOptions: { link: `${process.env.FRONTEND_URL || "https://bomavibes.tech"}/profile` } },
        });
    } catch (err) {
        console.error("[verification] notification", err);
    }
}

// PATCH /api/admin/verifications/:uid { decision: 'approve' | 'reject', reason }
async function reviewVerification(req, res) {
    const { uid } = req.params;
    const { decision, reason } = req.body || {};
    if (!["approve", "reject"].includes(decision)) {
        return res.status(400).json({ message: "Décision invalide" });
    }
    const rejectReason = decision === "reject" ? REJECT_REASONS[reason] || REJECT_REASONS.other : null;

    try {
        const ref = db.collection("verificationRequests").doc(uid);
        const request = (await ref.get()).data();
        if (request?.status !== "pending") {
            return res.status(409).json({ message: "Cette demande a déjà été traitée." });
        }

        const batch = db.batch();
        batch.update(ref, {
            status: decision === "approve" ? "approved" : "rejected",
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: req.firebaseUser.uid,
            rejectReason,
        });
        // Welcome bonus, once per account (not again after a revoke + re-approve).
        let bonusGiven = false;
        if (decision === "approve") {
            batch.update(db.collection("profiles").doc(uid), { verified: true });
            const userRef = db.collection("users").doc(uid);
            const account = (await userRef.get()).data();
            if (account && !account.verificationBonusAt) {
                batch.update(userRef, {
                    ngori: admin.firestore.FieldValue.increment(VERIFICATION_BONUS),
                    verificationBonusAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                bonusGiven = true;
            }
        }
        await batch.commit();
        removeVerificationFiles(uid);

        await logAdminAction(req, {
            action: decision === "approve" ? "APPROVE_VERIFICATION" : "REJECT_VERIFICATION",
            targetType: "user",
            targetId: uid,
            metadata: decision === "reject" ? { reason: reason || "other" } : null,
        });

        if (decision === "approve") {
            await notifyUser(
                uid,
                "Identité vérifiée ✓",
                bonusGiven
                    ? `Badge ✓ activé et +${VERIFICATION_BONUS} Ngori offerts ! Profitez de vos nouveaux avantages.`
                    : "Votre profil affiche maintenant le badge ✓.",
            );
        } else {
            await notifyUser(uid, "Vérification non validée", `${rejectReason} Vous pouvez réessayer depuis votre profil.`);
        }
        res.json({ status: decision === "approve" ? "approved" : "rejected" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la décision" });
    }
}

// DELETE /api/admin/verifications/:uid/badge — take a badge back (e.g. photos
// changed to someone else's).
async function revokeVerification(req, res) {
    const { uid } = req.params;
    try {
        await db.collection("profiles").doc(uid).update({ verified: false });
        await db.collection("verificationRequests").doc(uid).set(
            { status: "rejected", rejectReason: REJECT_REASONS.mismatch, reviewedAt: admin.firestore.FieldValue.serverTimestamp(), reviewedBy: req.firebaseUser.uid },
            { merge: true },
        );
        await logAdminAction(req, { action: "REVOKE_VERIFICATION", targetType: "user", targetId: uid });
        res.json({ status: "revoked" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de retirer le badge" });
    }
}

module.exports = {
    POSES,
    ID_TYPES,
    startVerification,
    submitVerification,
    getIdDocument,
    removeVerificationFiles,
    listVerifications,
    getSelfie,
    reviewVerification,
    revokeVerification,
};
