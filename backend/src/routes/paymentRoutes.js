const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { getPaymentConfig, startSingPayPayment, getPayment, singPayCallback } = require("../controllers/paymentController");

// /api/payments — online plan payments (SingPay Mobile Money, Gabon)
const router = express.Router();
router.get("/config", getPaymentConfig);
router.post("/singpay", requireFirebaseAuth, startSingPayPayment);
router.post("/singpay/callback", singPayCallback);
router.get("/:reference", requireFirebaseAuth, getPayment);

module.exports = router;
