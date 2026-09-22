const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { getSettings, updateSettings } = require("../controllers/settingsController");

const router = express.Router();

// Admin/Super Admin only — maintenanceMode alone can effectively take the
// site offline for everyone, so this isn't Moderator/Editor territory.
// (The public read side — showing the maintenance page to visitors — goes
// straight through the client Firestore SDK, like campaign/announcements;
// this router is only the admin write path.)
router.get("/", requireFirebaseAuth, requireAdmin, getSettings);
router.patch("/", requireFirebaseAuth, requireAdmin, updateSettings);

module.exports = router;
