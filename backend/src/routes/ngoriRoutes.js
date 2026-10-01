const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { getWallet, claimDaily, redeemReward } = require("../controllers/ngoriController");

// /api/ngori — daily coin and rewards (balances are written server-side only)
const router = express.Router();
router.get("/", requireFirebaseAuth, getWallet);
router.post("/claim", requireFirebaseAuth, claimDaily);
router.post("/redeem", requireFirebaseAuth, redeemReward);

module.exports = router;
