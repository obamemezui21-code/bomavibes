const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { claimReferral, getMyReferral } = require("../controllers/referralController");

// /api/referrals — inviting friends (rewards are written server-side only)
const router = express.Router();
router.use(requireFirebaseAuth);
router.get("/me", getMyReferral);
router.post("/claim", claimReferral);

module.exports = router;
