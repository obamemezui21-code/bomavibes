const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { getWeMet, answerWeMet } = require("../controllers/weMetController");

// /api/we-met — private "avez-vous rencontré … ?" feedback after a match
const router = express.Router();
router.use(requireFirebaseAuth);
router.get("/:matchId", getWeMet);
router.post("/:matchId", answerWeMet);

module.exports = router;
