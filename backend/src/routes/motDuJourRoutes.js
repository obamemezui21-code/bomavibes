const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getToday, submitGuess } = require("../controllers/motDuJourController");

// /api/mot-du-jour — LE MOT DU JOUR, the daily word game (guesses marked server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getToday);
router.post("/guess", submitGuess);

module.exports = router;
