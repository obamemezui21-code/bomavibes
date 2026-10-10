const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { startRace, finishRace, getLeaderboard, getMyStats } = require("../controllers/motoBomaController");

// /api/moto-boma — the MOTO BOMA motorbike race (races are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.post("/start", startRace);
router.post("/finish", finishRace);
router.get("/leaderboard", getLeaderboard);
router.get("/me", getMyStats);

module.exports = router;
