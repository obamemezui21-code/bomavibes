const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getPanther, startGame, finishGame } = require("../controllers/pantherController");

// /api/panthere — ŒIL DE PANTHÈRE (games are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getPanther);
router.post("/start", startGame);
router.post("/finish", finishGame);

module.exports = router;
