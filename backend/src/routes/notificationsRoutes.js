const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { sendBroadcast } = require("../controllers/notificationsController");

const router = express.Router();

// Broadcasting to (potentially) every device is Admin/Super Admin only —
// a bigger blast radius than a Moderator's or Editor's scope.
router.post("/broadcast", requireFirebaseAuth, requireAdmin, sendBroadcast);

module.exports = router;
