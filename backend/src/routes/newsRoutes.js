const express = require("express");
const { getHeadlines, getPlatformUpdates } = require("../controllers/newsController");

const router = express.Router();

router.get("/updates", getPlatformUpdates);
router.get("/headlines", getHeadlines);

module.exports = router;
