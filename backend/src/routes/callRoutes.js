const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { getIceServers } = require("../controllers/callController");

const router = express.Router();

router.get("/ice-servers", requireFirebaseAuth, getIceServers);

module.exports = router;
