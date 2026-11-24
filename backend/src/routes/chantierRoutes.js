const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getChantier, startGame, finishGame } = require("../controllers/chantierController");

// /api/chantier — CHANTIER BOMA (games are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getChantier);
router.post("/start", startGame);
router.post("/finish", finishGame);

module.exports = router;
