const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getFleche, startGame, finishGame } = require("../controllers/flecheController");

// /api/fleche — FLÈCHE D'ÉBÈNE (games are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getFleche);
router.post("/start", startGame);
router.post("/finish", finishGame);

module.exports = router;
