const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { setEphemeral } = require("../controllers/ephemeralController");

// /api/chat — conversation settings the app can't write itself.
const router = express.Router();
router.use(requireFirebaseAuth);
router.post("/:matchId/ephemeral", setEphemeral);

module.exports = router;
