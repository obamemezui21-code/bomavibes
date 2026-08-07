const express = require("express");
const multer = require("multer");
const os = require("os");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { uploadChatAttachment } = require("../controllers/chatAttachmentController");

// Images plus a conservative whitelist of common document types — never
// accept executables/scripts through a chat upload.
const ALLOWED_DOCUMENT_MIMETYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
]);

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/") || ALLOWED_DOCUMENT_MIMETYPES.has(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("Type de fichier non autorisé"));
    },
});

const router = express.Router();

router.post("/", requireFirebaseAuth, upload.single("file"), uploadChatAttachment);

module.exports = router;
