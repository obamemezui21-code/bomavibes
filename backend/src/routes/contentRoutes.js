const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireContent = require("../middleware/requireContentMiddleware");
const { listContent, getContent, createContent, updateContent, deleteContent } = require("../controllers/contentController");

const router = express.Router();

// :type is one of pages|articles|faqs|banners — validated against
// contentService.CONTENT_TYPES inside the service layer, not here.
router.get("/:type", requireFirebaseAuth, requireContent, listContent);
router.get("/:type/:id", requireFirebaseAuth, requireContent, getContent);
router.post("/:type", requireFirebaseAuth, requireContent, createContent);
router.patch("/:type/:id", requireFirebaseAuth, requireContent, updateContent);
router.delete("/:type/:id", requireFirebaseAuth, requireContent, deleteContent);

module.exports = router;
