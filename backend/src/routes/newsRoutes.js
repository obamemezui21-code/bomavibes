const express = require("express");
const { getWwfNews, getPlatformUpdates } = require("../controllers/newsController");

const router = express.Router();

router.get("/wwf-gabon", getWwfNews);
router.get("/updates", getPlatformUpdates);

module.exports = router;
