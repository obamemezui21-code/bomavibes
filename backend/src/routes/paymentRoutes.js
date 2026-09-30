const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { getPaymentConfig, startSingPayPayment, getPayment, singPayCallback } = require("../controllers/paymentController");
const { getPaymentsDashboard } = require("../controllers/adminPaymentsController");

// /api/payments — online plan payments (SingPay Mobile Money, Gabon)
const router = express.Router();
router.get("/config", getPaymentConfig);
router.post("/singpay", requireFirebaseAuth, startSingPayPayment);
router.post("/singpay/callback", singPayCallback);
router.get("/:reference", requireFirebaseAuth, getPayment);

// /api/admin/payments — revenue dashboard (Admin / Super Admin)
const adminRouter = express.Router();
adminRouter.get("/", requireFirebaseAuth, requireAdmin, getPaymentsDashboard);

module.exports = { router, adminRouter };
