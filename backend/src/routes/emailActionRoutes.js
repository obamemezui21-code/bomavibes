const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { sendPasswordReset, sendVerification } = require("../controllers/emailActionController");
const { register } = require("../controllers/signupController");
const {
    registerLimiter,
    passwordResetIpLimiter,
    passwordResetEmailLimiter,
    verificationEmailLimiter,
} = require("../middleware/rateLimits");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/send-password-reset", passwordResetIpLimiter, passwordResetEmailLimiter, sendPasswordReset);
router.post("/send-verification", requireFirebaseAuth, verificationEmailLimiter, sendVerification);

module.exports = router;
