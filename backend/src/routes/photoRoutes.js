const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadPhoto, photoQuality, appealPhoto } = require("../controllers/photoController");

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Fichier invalide"));
    cb(null, true);
  },
});

const router = express.Router();

router.post("/", requireFirebaseAuth, upload.single("photo"), uploadPhoto);
router.get("/quality", requireFirebaseAuth, photoQuality);
router.post("/appeal", requireFirebaseAuth, appealPhoto);

module.exports = router;
