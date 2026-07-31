const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const { getMe, updateMe } = require("../controllers/profileController");

const router = express.Router();

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);

module.exports = router;
