const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { listDirectory, getDirectoryUser, deleteDirectoryUser } = require("../controllers/userDirectoryController");

const router = express.Router();

// General user management ("Utilisateurs") — ADMIN/SUPER_ADMIN, distinct
// from the Super-Admin-only role management at /api/admin/users. Banning
// still goes through PATCH /api/admin/users/:uid/ban (shared with
// Moderators, see adminRoutes.js) — this router only adds browsing/search
// and account deletion.
router.get("/", requireFirebaseAuth, requireAdmin, listDirectory);
router.get("/:uid", requireFirebaseAuth, requireAdmin, getDirectoryUser);
router.delete("/:uid", requireFirebaseAuth, requireAdmin, deleteDirectoryUser);

module.exports = router;
