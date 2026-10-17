const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { ngoriRunLimiter } = require("../middleware/rateLimits");
const { getCommando, startMission, finishMission } = require("../controllers/commandoController");

// /api/commando — COMMANDO OKOUMÉ (missions are replayed and paid server-side)
const router = express.Router();
router.use(requireFirebaseAuth, ngoriRunLimiter);
router.get("/", getCommando);
router.post("/start", startMission);
router.post("/finish", finishMission);

module.exports = router;
