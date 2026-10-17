const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const {
    createGroupCall,
    declineGroupCall,
    groupCallStatus,
    inviteToGroupCall,
    joinGroupCall,
    leaveGroupCall,
} = require("../controllers/groupCallController");

const router = express.Router();

router.get("/status", requireFirebaseAuth, groupCallStatus);
router.post("/", requireFirebaseAuth, createGroupCall);
router.post("/:id/invite", requireFirebaseAuth, inviteToGroupCall);
router.post("/:id/join", requireFirebaseAuth, joinGroupCall);
router.post("/:id/decline", requireFirebaseAuth, declineGroupCall);
router.post("/:id/leave", requireFirebaseAuth, leaveGroupCall);

module.exports = router;
