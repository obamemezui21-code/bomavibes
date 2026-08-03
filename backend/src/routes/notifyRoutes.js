const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { notify } = require("../controllers/notifyController");

const router = express.Router();

router.post("/", requireFirebaseAuth, notify);

module.exports = router;
