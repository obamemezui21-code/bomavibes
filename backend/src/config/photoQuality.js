// HD profile photos are mandatory: the shorter side of every profile photo
// must be at least MIN_PHOTO_SIDE pixels. frontend-web/src/lib/photoQuality.js
// mirrors these rules (and holds the deadline given to existing members):
// keep both in sync.

const MIN_PHOTO_SIDE = 720;
// Every profile needs at least this many photos, each a real photo of the member.
const MIN_PROFILE_PHOTOS = 2;
// Members had until then to put real photos of themselves. After it, an
// account can be suspended (hidden from Discover, no likes, the app only opens
// the profile) — but only once a moderator confirmed its photos are refused,
// never on the automatic analysis alone (services/photoDecision.js).
const PHOTO_DEADLINE_MS = Date.parse("2026-10-21T23:59:59+01:00");
// photoController.js stores the "full" variant at most this wide.
const FULL_MAX_WIDTH = 1080;

// An uploaded original.
function isHdOriginal(width, height) {
  return Math.min(width, height) >= MIN_PHOTO_SIDE;
}

// A photo already stored on the server, where only the "full" variant is
// kept. A file that reached the width cap may come from a wide landscape
// original that was HD: it gets the benefit of the doubt.
function isHdStored(width, height) {
  return width >= FULL_MAX_WIDTH || isHdOriginal(width, height);
}

module.exports = { MIN_PHOTO_SIDE, MIN_PROFILE_PHOTOS, PHOTO_DEADLINE_MS, FULL_MAX_WIDTH, isHdOriginal, isHdStored };
