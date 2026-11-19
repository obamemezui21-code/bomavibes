const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireAdmin = require("../middleware/requireAdminMiddleware");
const { getPaymentConfig, startPayment, getPayment, singPayCallback, monerailsWebhook } = require("../controllers/paymentController");
const { getPaymentsDashboard } = require("../controllers/adminPaymentsController");

// /api/payments — online plan payments (Mobile Money, Gabon: Monerails, or SingPay)
const router = express.Router();
router.get("/config", getPaymentConfig);
router.post("/mobile-money", requireFirebaseAuth, startPayment);
// Same, for app versions still cached on phones.
router.post("/singpay", requireFirebaseAuth, startPayment);
router.post("/singpay/callback", singPayCallback);
// Raw body (app.js): its signature is computed on the exact bytes.
router.post("/monerails/webhook", monerailsWebhook);
router.get("/:reference", requireFirebaseAuth, getPayment);

// /api/admin/payments — revenue dashboard (Admin / Super Admin)
const adminRouter = express.Router();
adminRouter.get("/", requireFirebaseAuth, requireAdmin, getPaymentsDashboard);

module.exports = { router, adminRouter };
