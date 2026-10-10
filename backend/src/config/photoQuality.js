// HD profile photos are mandatory: the shorter side of every profile photo
// must be at least MIN_PHOTO_SIDE pixels. frontend-web/src/lib/photoQuality.js
// mirrors these rules (and holds the deadline given to existing members):
// keep both in sync.

const MIN_PHOTO_SIDE = 720;
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

module.exports = { MIN_PHOTO_SIDE, FULL_MAX_WIDTH, isHdOriginal, isHdStored };
