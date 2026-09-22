const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { reserveTicket, cancelTicket, listMyTickets } = require("../controllers/eventTicketController");

const router = express.Router();

// Any signed-in user — reserving/cancelling your own ticket isn't an admin
// action. Listing published events themselves goes straight through the
// client Firestore SDK (see firestore.rules: events is publicly readable
// when published), same pattern as announcements/CMS content.
router.get("/tickets/mine", requireFirebaseAuth, listMyTickets);
router.post("/:eventId/tickets", requireFirebaseAuth, reserveTicket);
router.delete("/:eventId/tickets", requireFirebaseAuth, cancelTicket);

module.exports = router;
