const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadFeedPhoto } = require("../controllers/feedPhotoController");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) return cb(null, true);
        cb(new Error("Type de fichier non autorisé"));
    },
});

const router = express.Router();

router.post("/", requireFirebaseAuth, upload.single("photo"), uploadFeedPhoto);

module.exports = router;
