const express = require("express");
const { getWwfNews } = require("../controllers/newsController");

const router = express.Router();

router.get("/wwf-gabon", getWwfNews);

module.exports = router;
