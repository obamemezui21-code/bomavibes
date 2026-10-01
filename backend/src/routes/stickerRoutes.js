const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { createSticker, deleteSticker } = require("../controllers/stickerController");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) return cb(null, true);
        cb(new Error("Type de fichier non autorisé"));
    },
});

// /api/stickers — user-made chat stickers
const router = express.Router();
router.post("/", requireFirebaseAuth, upload.single("sticker"), createSticker);
router.delete("/:id", requireFirebaseAuth, deleteSticker);

module.exports = router;
