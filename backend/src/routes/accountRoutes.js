const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { deleteAccount } = require("../controllers/accountController");

const router = express.Router();

router.delete("/", requireFirebaseAuth, deleteAccount);

module.exports = router;
