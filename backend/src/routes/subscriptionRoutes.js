const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { recordSwipe, getQuota, getIncomingLikesCount, getIncomingLikers } = require("../controllers/swipeController");
const { setUserPlan, boostProfile, setInvisible } = require("../controllers/subscriptionController");

// /api/swipes — likes go through the server so plan quotas are enforced.
const swipeRouter = express.Router();
swipeRouter.post("/", requireFirebaseAuth, recordSwipe);
swipeRouter.get("/quota", requireFirebaseAuth, getQuota);
swipeRouter.get("/likes-count", requireFirebaseAuth, getIncomingLikesCount);
swipeRouter.get("/likers", requireFirebaseAuth, getIncomingLikers);

// /api/me — subscriber perks
const meRouter = express.Router();
meRouter.post("/boost", requireFirebaseAuth, boostProfile);
meRouter.post("/invisible", requireFirebaseAuth, setInvisible);

// /api/admin/subscriptions — manual plan activation (Admin / Super Admin)
const adminRouter = express.Router();
adminRouter.patch("/:uid", requireFirebaseAuth, requireAdmin, setUserPlan);

module.exports = { swipeRouter, meRouter, adminRouter };
