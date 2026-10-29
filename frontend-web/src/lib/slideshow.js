// The profile photo slideshow's rules (components/PhotoSlideshow.jsx), kept
// apart so they can be tested.

// The photo `step` away (1 next, -1 previous), looping at both ends.
export function nextIndex(index, step, count) {
  if (count < 2) return 0
  return (((index + step) % count) + count) % count
}

export const SWIPE_PX = 40
export const TAP_SLOP_PX = 12

/**
 * What a finger or mouse gesture on the photo does.
 * @param {{ dx: number, dy: number, x: number, width: number, held: boolean }} g
 *   dx / dy: how far it moved; x: where it ended, from the photo's left edge
 * @returns {1 | -1 | 0} next, previous, or nothing (a hold, a vertical scroll)
 */
export function gestureFor({ dx, dy, x, width, held }) {
  if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : -1
  if (held || Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) return 0
  return x < width / 2 ? -1 : 1
}
