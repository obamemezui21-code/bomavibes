const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getEscadrille, startGame, finishGame } = require("../controllers/escadrilleController");

// /api/escadrille — ESCADRILLE OGOUÉ (sorties are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getEscadrille);
router.post("/start", startGame);
router.post("/finish", finishGame);

module.exports = router;
