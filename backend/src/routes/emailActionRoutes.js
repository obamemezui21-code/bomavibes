const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { sendPasswordReset, sendVerification } = require("../controllers/emailActionController");

const router = express.Router();

router.post("/send-password-reset", sendPasswordReset);
router.post("/send-verification", requireFirebaseAuth, sendVerification);

module.exports = router;
