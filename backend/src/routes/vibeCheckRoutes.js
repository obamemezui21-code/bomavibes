const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getToday, submitAnswers, getResults, sendVibe } = require("../controllers/vibeCheckController");

// /api/vibe-check — VIBE CHECK, blind matching on the day's "ceci ou cela" answers
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getToday);
router.post("/answers", submitAnswers);
router.get("/results", getResults);
router.post("/vibe", sendVibe);

module.exports = router;
