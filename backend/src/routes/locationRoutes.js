const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { saveLocation, deleteLocation, getDistances } = require("../controllers/locationController");

// /api/location — members' positions stay on the server; only rounded
// distances come back (controllers/locationController.js).
const router = express.Router();
router.use(requireFirebaseAuth);
router.post("/", saveLocation);
router.delete("/", deleteLocation);
router.post("/distances", getDistances);

module.exports = router;
