const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadStoryVideo, uploadFeedVideo, VIDEO_EXTENSIONS } = require("../controllers/storyVideoController");

// Video uploads (video + optional poster frame). The app checks the length
// before uploading; nginx's client_max_body_size must allow the size.
function videoUploadRouter(maxBytes, handler) {
    const upload = multer({
        dest: os.tmpdir(),
        limits: { fileSize: maxBytes, files: 2 },
        fileFilter: (req, file, cb) => {
            if (file.fieldname === "video" && VIDEO_EXTENSIONS[file.mimetype]) return cb(null, true);
            if (file.fieldname === "poster" && file.mimetype.startsWith("image/")) return cb(null, true);
            cb(new Error("Type de fichier non autorisé"));
        },
    });
    const mb = Math.round(maxBytes / (1024 * 1024));

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
                res.status(tooBig ? 413 : 400).json({ message: tooBig ? `Vidéo trop lourde (${mb} Mo maximum).` : err.message });
            }),
        handler,
    );
    return router;
}

// Stories: 25 MB ≈ 30 s of phone video at 720p–1080p.
const storyVideoRouter = videoUploadRouter(25 * 1024 * 1024, uploadStoryVideo);
// Feed posts: up to 60 s, so twice the room.
const feedVideoRouter = videoUploadRouter(50 * 1024 * 1024, uploadFeedVideo);

module.exports = storyVideoRouter;
module.exports.feedVideoRouter = feedVideoRouter;
