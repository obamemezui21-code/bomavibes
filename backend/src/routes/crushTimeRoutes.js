const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { getCrushTime, guessCrush } = require("../controllers/crushTimeController");

// /api/crush-time — guess which of 4 profiles liked you
const router = express.Router();
router.use(requireFirebaseAuth);
router.get("/", getCrushTime);
router.post("/guess", guessCrush);

module.exports = router;
