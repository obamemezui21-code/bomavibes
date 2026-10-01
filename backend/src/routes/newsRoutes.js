const express = require("express");
const { getPlatformUpdates } = require("../controllers/newsController");

const router = express.Router();

router.get("/updates", getPlatformUpdates);

module.exports = router;
