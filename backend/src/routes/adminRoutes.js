const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const requireModeration = require("../middleware/requireModerationMiddleware");
const requireSuperAdmin = require("../middleware/requireSuperAdminMiddleware");
const { getStats, listReports, updateReportStatus, deletePost, getActivitySeries, getLogs } = require("../controllers/adminController");
const { listUsers, updateUserRole, setUserBanned } = require("../controllers/adminUsersController");

const router = express.Router();

router.get("/stats", requireFirebaseAuth, requireAdmin, getStats);
router.get("/activity", requireFirebaseAuth, requireAdmin, getActivitySeries);
router.get("/logs", requireFirebaseAuth, requireAdmin, getLogs);

// Reports, post removal, and banning are the Moderator's whole job — ADMIN
// and SUPER_ADMIN also pass this check, so nothing changes for them.
router.get("/reports", requireFirebaseAuth, requireModeration, listReports);
router.patch("/reports/:id", requireFirebaseAuth, requireModeration, updateReportStatus);
router.delete("/posts/:postId", requireFirebaseAuth, requireModeration, deletePost);
router.patch("/users/:uid/ban", requireFirebaseAuth, requireModeration, setUserBanned);

// Role management (nominating/removing Admins) is Super-Admin-exclusive.
router.get("/users", requireFirebaseAuth, requireSuperAdmin, listUsers);
router.patch("/users/:uid/role", requireFirebaseAuth, requireSuperAdmin, updateUserRole);

module.exports = router;
