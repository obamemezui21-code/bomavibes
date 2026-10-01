const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { startRun, finishRun, getLeaderboard, getMyRunStats } = require("../controllers/ngoriRunController");

// /api/ngori-run — the NGORI RUN mini-game (runs are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.post("/start", startRun);
router.post("/finish", finishRun);
router.get("/leaderboard", getLeaderboard);
router.get("/me", getMyRunStats);

module.exports = router;
