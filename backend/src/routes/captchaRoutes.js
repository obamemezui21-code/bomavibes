const express = require("express");
const { verifyCaptcha } = require("../controllers/captchaController");

const router = express.Router();

// Public on purpose — this runs before the visitor has an account, so
// there's no Firebase ID token yet to require.
router.post("/verify", verifyCaptcha);

module.exports = router;
