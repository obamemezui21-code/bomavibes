const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const requireModeration = require("../middleware/requireModerationMiddleware");
const {
  startVerification,
  submitVerification,
  getIdDocument,
  listVerifications,
  getSelfie,
  reviewVerification,
  revokeVerification,
} = require("../controllers/verificationController");

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Fichier invalide"));
    cb(null, true);
  },
});

// User side — mounted at /api/verification
const userRouter = express.Router();
userRouter.post("/start", requireFirebaseAuth, startVerification);
// Identity document + selfie, both required, sent together.
userRouter.post(
  "/submit",
  requireFirebaseAuth,
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  submitVerification,
);

// Moderation side — mounted at /api/admin/verifications (same access as
// the Signalements tab: moderators, admins, super admins)
const adminRouter = express.Router();
adminRouter.get("/", requireFirebaseAuth, requireModeration, listVerifications);
adminRouter.get("/:uid/selfie", requireFirebaseAuth, requireModeration, getSelfie);
adminRouter.get("/:uid/id-document", requireFirebaseAuth, requireModeration, getIdDocument);
adminRouter.patch("/:uid", requireFirebaseAuth, requireModeration, reviewVerification);
adminRouter.delete("/:uid/badge", requireFirebaseAuth, requireModeration, revokeVerification);

module.exports = { userRouter, adminRouter };
