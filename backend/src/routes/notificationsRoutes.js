const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { sendBroadcast } = require("../controllers/notificationsController");
const { getAnnouncement, updateAnnouncement, deleteAnnouncement } = require("../controllers/announcementController");

const router = express.Router();

// Broadcasting to (potentially) every device is Admin/Super Admin only —
// a bigger blast radius than a Moderator's or Editor's scope.
router.post("/broadcast", requireFirebaseAuth, requireAdmin, sendBroadcast);

// Editing/deleting the public announcement a past broadcast created — the
// SEND_NOTIFICATION log entry itself (in "Historique") is never touched,
// see announcementController.js.
router.get("/announcements/:id", requireFirebaseAuth, requireAdmin, getAnnouncement);
router.patch("/announcements/:id", requireFirebaseAuth, requireAdmin, updateAnnouncement);
router.delete("/announcements/:id", requireFirebaseAuth, requireAdmin, deleteAnnouncement);

module.exports = router;
