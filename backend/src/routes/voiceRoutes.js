const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadVoiceNote, uploadVoicePrompt, deleteVoicePrompt } = require("../controllers/voiceController");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("audio/")) return cb(new Error("Fichier invalide"));
        cb(null, true);
    },
});

const router = express.Router();

router.post("/", requireFirebaseAuth, upload.single("voice"), uploadVoiceNote);
router.post("/profile", requireFirebaseAuth, upload.single("voice"), uploadVoicePrompt);
router.delete("/profile", requireFirebaseAuth, deleteVoicePrompt);

module.exports = router;
