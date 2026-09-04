const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { uploadMusicTrack, deleteMusicTrack } = require("../controllers/musicController");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("audio/")) return cb(new Error("Fichier invalide"));
        cb(null, true);
    },
});

const router = express.Router();

router.post("/", requireFirebaseAuth, requireAdmin, upload.single("track"), uploadMusicTrack);
router.delete("/", requireFirebaseAuth, requireAdmin, deleteMusicTrack);

module.exports = router;
