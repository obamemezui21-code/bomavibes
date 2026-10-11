const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { startFight, finishFight, getLeaderboard, getMyStats } = require("../controllers/bomaFightController");

// /api/boma-fight — the BOMA FIGHT fighting game (fights are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.post("/start", startFight);
router.post("/finish", finishFight);
router.get("/leaderboard", getLeaderboard);
router.get("/me", getMyStats);

module.exports = router;
