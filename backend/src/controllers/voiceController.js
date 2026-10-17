const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "voice-notes");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

async function uploadVoiceNote(req, res) {
    const uid = req.firebaseUser.uid;

    if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier reçu" });
    }

    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const filename = `voice-${Date.now()}.webm`;
        const destPath = path.join(dir, filename);
        fs.renameSync(req.file.path, destPath);

        const url = `${FRONTEND_URL}/uploads/voice-notes/${uid}/${filename}`;
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la note vocale" });
    }
}


// ---- Voice prompt on the profile (Hinge-style) ------------------------------
// One short recorded answer to a question, shown on the profile sheet.
// Set here only (Admin SDK), so the url always points at our own uploads;
// firestore.rules keep voicePrompt out of client writes.
const admin = require("../config/firebaseAdmin");

const VOICE_PROMPT_MAX_SECONDS = 30;
const VOICE_PROMPT_QUESTION_MAX = 120;

function removeOwnPromptFile(uid, url) {
    const prefix = `${FRONTEND_URL}/uploads/voice-notes/${uid}/`;
    if (typeof url !== "string" || !url.startsWith(prefix)) return;
    const name = path.basename(url.slice(prefix.length));
    if (!name.startsWith("prompt-")) return;
    fs.unlink(path.join(UPLOAD_ROOT, uid, name), () => {});
}

// POST /api/voice/profile (multipart: voice, question, duration)
async function uploadVoicePrompt(req, res) {
    const uid = req.firebaseUser.uid;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const duration = Math.round(Number(req.body?.duration));
    if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu" });
    if (!question || question.length > VOICE_PROMPT_QUESTION_MAX || !(duration >= 1 && duration <= VOICE_PROMPT_MAX_SECONDS + 1)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Requête invalide" });
    }
    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const filename = `prompt-${Date.now()}.webm`;
        fs.renameSync(req.file.path, path.join(dir, filename));

        const profileRef = admin.firestore().collection("profiles").doc(uid);
        const previous = (await profileRef.get()).data()?.voicePrompt;
        const voicePrompt = {
            question,
            url: `${FRONTEND_URL}/uploads/voice-notes/${uid}/${filename}`,
            duration: Math.min(duration, VOICE_PROMPT_MAX_SECONDS),
        };
        await profileRef.set({ voicePrompt }, { merge: true });
        removeOwnPromptFile(uid, previous?.url);
        res.json({ voicePrompt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la note vocale" });
    }
}

// DELETE /api/voice/profile
async function deleteVoicePrompt(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        const profileRef = admin.firestore().collection("profiles").doc(uid);
        const previous = (await profileRef.get()).data()?.voicePrompt;
        await profileRef.set({ voicePrompt: admin.firestore.FieldValue.delete() }, { merge: true });
        removeOwnPromptFile(uid, previous?.url);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer la note vocale" });
    }
}

module.exports = { uploadVoiceNote, uploadVoicePrompt, deleteVoicePrompt };
