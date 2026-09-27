const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { listPartners, createPartner, updatePartner, deletePartner, getStats } = require("../controllers/aiPartnersController");

const router = express.Router();

// Admin/Super Admin only — affiliate links and commission structure are
// business-sensitive, narrower than the Editor-accessible CMS content
// (pages/articles/events/venues). Public reads go straight through the
// client Firestore SDK (see firestore.rules: aiPartners is publicly
// readable), same pattern as events/venues.
router.get("/", requireFirebaseAuth, requireAdmin, listPartners);
router.get("/stats", requireFirebaseAuth, requireAdmin, getStats);
router.post("/", requireFirebaseAuth, requireAdmin, createPartner);
router.patch("/:id", requireFirebaseAuth, requireAdmin, updatePartner);
router.delete("/:id", requireFirebaseAuth, requireAdmin, deletePartner);

module.exports = router;
