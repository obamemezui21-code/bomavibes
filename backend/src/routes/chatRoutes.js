const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { setEphemeral } = require("../controllers/ephemeralController");
const { clearChat } = require("../controllers/clearChatController");

// /api/chat — conversation settings the app can't write itself.
const router = express.Router();
router.use(requireFirebaseAuth);
router.post("/:matchId/ephemeral", setEphemeral);
// "Supprimer la discussion", for the member asking only.
router.post("/:matchId/clear", clearChat);

module.exports = router;
