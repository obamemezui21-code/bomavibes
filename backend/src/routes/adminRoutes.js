const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const requireSuperAdmin = require("../middleware/requireSuperAdminMiddleware");
const { getStats, listReports, updateReportStatus } = require("../controllers/adminController");
const { listUsers, updateUserRole } = require("../controllers/adminUsersController");

const router = express.Router();

router.get("/stats", requireFirebaseAuth, requireAdmin, getStats);
router.get("/reports", requireFirebaseAuth, requireAdmin, listReports);
router.patch("/reports/:id", requireFirebaseAuth, requireAdmin, updateReportStatus);

// Role management (nominating/removing Admins) is Super-Admin-exclusive.
router.get("/users", requireFirebaseAuth, requireSuperAdmin, listUsers);
router.patch("/users/:uid/role", requireFirebaseAuth, requireSuperAdmin, updateUserRole);

module.exports = router;
