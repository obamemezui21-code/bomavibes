const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const admin = require("../config/firebaseAdmin");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();

// Selfie verification (the "Profil vérifié" badge).
//
// 1. The user asks to start: the SERVER picks a random pose, so a selfie
//    can't be an old photo prepared in advance.
// 2. The user uploads a selfie doing that pose → request goes "pending".
// 3. A moderator compares it with the profile photos and approves (sets
//    profiles/{uid}.verified — only the Admin SDK can) or rejects it.
//
// verificationRequests/{uid}: { status, pose, poseAssignedAt, submittedAt,
//   reviewedAt, reviewedBy, rejectReason }
// status: awaiting_selfie → pending → approved | rejected
//
// Selfies are PRIVATE: stored outside the public uploads folder, only
// streamed to moderators, and deleted as soon as a decision is made.
const SELFIE_DIR = path.join(__dirname, "..", "..", "private", "verification-selfies");
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
    other: "La vérification n'a pas pu être validée.",
};

function selfiePath(uid) {
    // uids are Firebase ids (alphanumeric), never user input paths — but
    // strip anything else anyway before touching the filesystem.
    return path.join(SELFIE_DIR, `${String(uid).replace(/[^A-Za-z0-9_-]/g, "")}.jpg`);
}

function removeSelfie(uid) {
    fs.unlink(selfiePath(uid), () => {});
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

// POST /api/verification/selfie (multipart "selfie")
async function submitSelfie(req, res) {
    const uid = req.firebaseUser.uid;
    if (!req.file) return res.status(400).json({ message: "Aucune photo reçue" });

    try {
        const ref = db.collection("verificationRequests").doc(uid);
        const request = (await ref.get()).data();
        const assignedAt = request?.poseAssignedAt?.toMillis?.() || 0;
        if (request?.status !== "awaiting_selfie" || Date.now() - assignedAt > POSE_VALID_MS) {
            fs.unlink(req.file.path, () => {});
            return res.status(409).json({ message: "La pose a expiré, recommencez la vérification." });
        }

        fs.mkdirSync(SELFIE_DIR, { recursive: true });
        // Re-encode: fixes orientation, caps the size and drops EXIF
        // (location etc.) — sharp doesn't copy metadata unless asked.
        await sharp(req.file.path)
            .rotate()
            .resize({ width: 1080, height: 1080, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(selfiePath(uid));
        fs.unlink(req.file.path, () => {});

        await ref.update({ status: "pending", submittedAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ status: "pending" });
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ message: "Impossible d'envoyer la photo" });
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
        if (decision === "approve") {
            batch.update(db.collection("profiles").doc(uid), { verified: true });
        }
        await batch.commit();
        removeSelfie(uid);

        await logAdminAction(req, {
            action: decision === "approve" ? "APPROVE_VERIFICATION" : "REJECT_VERIFICATION",
            targetType: "user",
            targetId: uid,
            metadata: decision === "reject" ? { reason: reason || "other" } : null,
        });

        if (decision === "approve") {
            await notifyUser(uid, "Profil vérifié ✓", "Votre profil affiche maintenant le badge « vérifié ».");
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
    startVerification,
    submitSelfie,
    listVerifications,
    getSelfie,
    reviewVerification,
    revokeVerification,
};
