const crypto = require("crypto");

// ICE servers for audio/video calls (WebRTC).
//
// STUN lets two phones find each other directly; TURN relays the media when
// a direct path is impossible (common on mobile carrier networks). TURN runs
// on our own VPS (coturn, `use-auth-secret` mode), so instead of a fixed
// password we hand out short-lived credentials derived from the shared
// secret — the standard "TURN REST API" scheme coturn verifies on its own:
//   username   = "<expiry unix time>:<uid>"
//   credential = base64(HMAC-SHA1(TURN_SECRET, username))
// Leaked credentials therefore stop working after TURN_TTL_SECONDS.
const TURN_TTL_SECONDS = 6 * 60 * 60;

const PUBLIC_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

function getIceServers(req, res) {
  const iceServers = [{ urls: PUBLIC_STUN }];

  const secret = process.env.TURN_SECRET;
  const host = process.env.TURN_HOST;
  if (secret && host) {
    const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS}:${req.firebaseUser.uid}`;
    const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
    iceServers.push({
      urls: [
        `stun:${host}:3478`,
        `turn:${host}:3478?transport=udp`,
        `turn:${host}:3478?transport=tcp`,
      ],
      username,
      credential,
    });
  }

  res.json({ iceServers, ttl: TURN_TTL_SECONDS });
}

module.exports = { getIceServers };
