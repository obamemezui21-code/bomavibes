const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { cvLimiter } = require("../middleware/rateLimits");
const { getCv, saveCv, generateCv } = require("../controllers/cvController");

// /api/cv — CV PNPE written with the AI, for signed-in members
const router = express.Router();
router.use(requireFirebaseAuth, cvLimiter);
router.get("/", getCv);
router.put("/", saveCv);
router.post("/generate", generateCv);

module.exports = router;
