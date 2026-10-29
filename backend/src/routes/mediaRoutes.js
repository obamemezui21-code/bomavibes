const express = require("express");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { mediaCookies, clearedMediaCookies } = require("../services/mediaCookie");

// /api/media — the signed cookie that lets a signed-in member's browser load
// members' photos (services/mediaCookie.js). MEDIA_SECRET is shared with
// nginx (deployment/protect-uploads.sh writes both); without it the photos
// aren't protected yet and there is no cookie to hand out.
const router = express.Router();

// POST /api/media/session → { exp } (Unix seconds), or { exp: null } when protection is off
router.post("/session", requireFirebaseAuth, (req, res) => {
    const secret = process.env.MEDIA_SECRET;
    if (!secret) return res.json({ exp: null });
    const { exp, headers } = mediaCookies(req.firebaseUser.uid, secret);
    res.setHeader("Set-Cookie", headers);
    res.setHeader("Cache-Control", "no-store");
    res.json({ exp });
});

// DELETE /api/media/session — on sign-out
router.delete("/session", (req, res) => {
    res.setHeader("Set-Cookie", clearedMediaCookies());
    res.status(204).end();
});

module.exports = router;
