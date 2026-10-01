const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadStoryVideo, VIDEO_EXTENSIONS } = require("../controllers/storyVideoController");

// 25 MB ≈ 30 s of phone video at 720p–1080p. The app checks the length
// (30 s max) before uploading; nginx's client_max_body_size must allow it.
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: MAX_VIDEO_BYTES, files: 2 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "video" && VIDEO_EXTENSIONS[file.mimetype]) return cb(null, true);
        if (file.fieldname === "poster" && file.mimetype.startsWith("image/")) return cb(null, true);
        cb(new Error("Type de fichier non autorisé"));
    },
});

const router = express.Router();

router.post(
    "/",
    requireFirebaseAuth,
    (req, res, next) =>
        upload.fields([
            { name: "video", maxCount: 1 },
            { name: "poster", maxCount: 1 },
        ])(req, res, (err) => {
            if (!err) return next();
            const tooBig = err.code === "LIMIT_FILE_SIZE";
            res.status(tooBig ? 413 : 400).json({ message: tooBig ? "Vidéo trop lourde (25 Mo maximum)." : err.message });
        }),
    uploadStoryVideo,
);

module.exports = router;
