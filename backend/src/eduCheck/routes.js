const express = require("express");
const multer = require("multer");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { limiter } = require("../middleware/rateLimits");
const { requireEduAccess } = require("./access");
const { CONFIG } = require("./config");
const c = require("./controller");

// /api/edu-check — mounted in app.js, with its own JSON size limit (a long
// homework is bigger than the app's default 100 kB).

const MINUTE = 60 * 1000;
const eduLimiter = limiter({
    windowMs: 10 * MINUTE,
    limit: 200,
    message: "Trop de requêtes, réessayez dans quelques minutes.",
    keyGenerator: (req) => `edu:${req.firebaseUser.uid}`,
});
// Analyses and comparisons cost the most: fewer of them.
const runLimiter = limiter({
    windowMs: 10 * MINUTE,
    limit: 30,
    message: "Beaucoup d’analyses lancées : réessayez dans quelques minutes.",
    keyGenerator: (req) => `edu-run:${req.firebaseUser.uid}`,
});

// In memory only: the file is never written to disk, only its text is used.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: CONFIG.maxFileBytes, files: 1, fields: 5 },
    fileFilter: (req, file, cb) => cb(null, /\.(pdf|docx|txt)$/i.test(file.originalname || "")),
});

function uploadFile(req, res, next) {
    upload.single("file")(req, res, (err) => {
        if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: `Fichier trop lourd (maximum ${Math.round(CONFIG.maxFileBytes / 1024 / 1024)} Mo).` });
        if (err) return res.status(400).json({ message: "Fichier refusé." });
        if (!req.file) return res.status(400).json({ message: "Format non pris en charge : importez un fichier PDF, DOCX ou TXT." });
        next();
    });
}

const router = express.Router();
router.use(requireFirebaseAuth, eduLimiter);
// Whether this account may use the module (answers even when it may not).
router.get("/me", c.getMe);

router.use(requireEduAccess);
router.post("/parse", runLimiter, uploadFile, c.parseFile);
router.post("/analyses", runLimiter, c.createAnalysis);
router.get("/analyses", c.listAnalyses);
router.get("/analyses/:id", c.getAnalysis);
router.delete("/analyses/:id", c.deleteAnalysis);
router.post("/compare", runLimiter, c.compare);
router.get("/dashboard", c.getDashboard);

module.exports = router;
