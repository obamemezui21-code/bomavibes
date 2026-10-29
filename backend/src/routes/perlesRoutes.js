const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getPerles, startGame, finishGame } = require("../controllers/perlesController");

// /api/perles — PERLES PUNU (games are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getPerles);
router.post("/start", startGame);
router.post("/finish", finishGame);

module.exports = router;
