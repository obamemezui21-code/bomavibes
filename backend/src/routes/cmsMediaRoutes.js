const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireContent = require("../middleware/requireContentMiddleware");
const { uploadCmsMedia, listCmsMedia, deleteCmsMedia } = require("../controllers/cmsMediaController");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) return cb(new Error("Fichier invalide"));
        cb(null, true);
    },
});

const router = express.Router();

router.get("/", requireFirebaseAuth, requireContent, listCmsMedia);
router.post("/", requireFirebaseAuth, requireContent, upload.single("image"), uploadCmsMedia);
router.delete("/:name", requireFirebaseAuth, requireContent, deleteCmsMedia);

module.exports = router;
