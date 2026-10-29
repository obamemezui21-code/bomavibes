const crypto = require("crypto");

// Members' photos (profile photos, chat attachments) are only served to a
// signed-in member: nginx checks a signed cookie on /uploads/profile-photos/
// and /uploads/chat-attachments/ with its secure_link module
// (deployment/protect-uploads.sh), so a copied link is useless outside the
// app and stops working when the cookie expires.
//
// Three cookies, path /uploads/: bv_m_exp (expiry, Unix seconds), bv_m_uid
// (whose session it is) and bv_m_sig, which is what nginx recomputes:
//   secure_link_md5 "$cookie_bv_m_exp$cookie_bv_m_uid <MEDIA_SECRET>";
// i.e. base64url(md5("<exp><uid> <secret>")), unpadded — nginx's format.

const MEDIA_TTL_S = 12 * 60 * 60;
const COOKIE_PATH = "/uploads/";
const NAMES = { exp: "bv_m_exp", uid: "bv_m_uid", sig: "bv_m_sig" };

function mediaSignature(exp, uid, secret) {
    return crypto.createHash("md5").update(`${exp}${uid} ${secret}`).digest("base64url");
}

// The Set-Cookie header values for a session of `uid` from `nowMs`.
function mediaCookies(uid, secret, nowMs = Date.now()) {
    const exp = Math.floor(nowMs / 1000) + MEDIA_TTL_S;
    const attrs = `Path=${COOKIE_PATH}; Max-Age=${MEDIA_TTL_S}; HttpOnly; Secure; SameSite=Lax`;
    return {
        exp,
        headers: [
            `${NAMES.exp}=${exp}; ${attrs}`,
            `${NAMES.uid}=${encodeURIComponent(uid)}; ${attrs}`,
            `${NAMES.sig}=${mediaSignature(exp, uid, secret)}; ${attrs}`,
        ],
    };
}

// Headers that delete the session (on sign-out).
function clearedMediaCookies() {
    const attrs = `Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
    return Object.values(NAMES).map((name) => `${name}=; ${attrs}`);
}

module.exports = { MEDIA_TTL_S, mediaSignature, mediaCookies, clearedMediaCookies };
