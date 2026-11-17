// The profile photo slideshow's rules (components/PhotoSlideshow.jsx), kept
// apart so they can be tested.

// The photo `step` away (1 next, -1 previous), looping at both ends.
export function nextIndex(index, step, count) {
  if (count < 2) return 0
  return (((index + step) % count) + count) % count
}

export const SWIPE_PX = 40
export const TAP_SLOP_PX = 12

// With a full-screen view to open, a tap on the middle of the photo opens
// it; the edges (this share of the width on each side) still change photo.
export const EDGE_SHARE = 0.3

/**
 * What a finger or mouse gesture on the photo does.
 * @param {{ dx: number, dy: number, x: number, width: number, held: boolean,
 *   multiple?: boolean, canOpen?: boolean }} g
 *   dx / dy: how far it moved; x: where it ended, from the photo's left edge;
 *   multiple: more than one photo; canOpen: a tap can open the full-screen view
 * @returns {1 | -1 | 0 | 'open'} next, previous, nothing (a hold, a vertical
 *   scroll), or open the full-screen view
 */
export function gestureFor({ dx, dy, x, width, held, multiple = true, canOpen = false }) {
  if (multiple && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : -1
  if (held || Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) return 0
  if (canOpen && (!multiple || (x >= width * EDGE_SHARE && x <= width * (1 - EDGE_SHARE)))) return 'open'
  if (!multiple) return 0
  return x < width / 2 ? -1 : 1
}
