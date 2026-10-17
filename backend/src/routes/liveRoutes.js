const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireModeration = require("../middleware/requireModerationMiddleware");
const { liveStatus, startLive, joinLive, endLive, cutLive, commentLive, giftLive } = require("../controllers/liveController");

// /api/lives — lives on the LiveKit media server
const router = express.Router();
router.use(requireFirebaseAuth);
router.get("/status", liveStatus);
router.post("/", startLive);
router.post("/:id/join", joinLive);
router.post("/:id/end", endLive);
router.post("/:id/comments", commentLive);
router.post("/:id/gift", giftLive);

// /api/admin/lives — moderation
const adminRouter = express.Router();
adminRouter.post("/:id/end", requireFirebaseAuth, requireModeration, cutLive);

module.exports = { router, adminRouter };
