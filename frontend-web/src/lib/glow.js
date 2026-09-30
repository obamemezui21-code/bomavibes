// Soft coloured halo for section backgrounds. A radial gradient looks the
// same as a big `blur-[120px]` blob but costs nothing to paint — heavy CSS
// blurs were a main cause of scroll jank on phones.
//   color: a CSS colour, e.g. 'var(--color-pink-500)' or '#f2bf4e'
//   strength: 0–100, opacity of the centre
export function glow(color, strength) {
  return {
    background: `radial-gradient(closest-side, color-mix(in srgb, ${color} ${strength}%, transparent), transparent)`,
  }
}
