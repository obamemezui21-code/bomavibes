const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireModeration = require("../middleware/requireModerationMiddleware");
const { listPhotoReviews, getPhotoReviewImage, decidePhotoReview } = require("../controllers/photoReviewController");

// /api/admin/photo-reviews — the photo moderation queue (same access as the
// Signalements and Vérifications tabs: moderators, admins, super admins).
const router = express.Router();
router.use(requireFirebaseAuth, requireModeration);
router.get("/", listPhotoReviews);
router.get("/:id/image", getPhotoReviewImage);
router.patch("/:id", decidePhotoReview);

module.exports = router;
