const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const requireSuperAdmin = require("../middleware/requireSuperAdminMiddleware");
const { getStats, listReports, updateReportStatus, deletePost, getActivitySeries } = require("../controllers/adminController");
const { listUsers, updateUserRole, setUserBanned } = require("../controllers/adminUsersController");

const router = express.Router();

router.get("/stats", requireFirebaseAuth, requireAdmin, getStats);
router.get("/activity", requireFirebaseAuth, requireAdmin, getActivitySeries);
router.get("/reports", requireFirebaseAuth, requireAdmin, listReports);
router.patch("/reports/:id", requireFirebaseAuth, requireAdmin, updateReportStatus);
router.delete("/posts/:postId", requireFirebaseAuth, requireAdmin, deletePost);

// Banning targets ROLES.USER only (enforced in the controller), so it's
// safe for any Admin — not just the Super Admin — same trust level as
// acting on a report.
router.patch("/users/:uid/ban", requireFirebaseAuth, requireAdmin, setUserBanned);

// Role management (nominating/removing Admins) is Super-Admin-exclusive.
router.get("/users", requireFirebaseAuth, requireSuperAdmin, listUsers);
router.patch("/users/:uid/role", requireFirebaseAuth, requireSuperAdmin, updateUserRole);

module.exports = router;
