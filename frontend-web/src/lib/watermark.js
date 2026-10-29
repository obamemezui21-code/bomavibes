// The watermark laid over members' photos and conversations: the viewer's
// first name and the start of their id, tiled and slanted, faint but in every
// screenshot — so a leaked capture says who took it.

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])
}

// "Aïcha · 3fK9xQ2a" — what's written.
export function watermarkLabel(firstName, uid) {
  const name = (firstName || 'Membre').trim().slice(0, 24) || 'Membre'
  return uid ? `${name} · ${String(uid).slice(0, 8)}` : name
}

export const TILE_W = 220
export const TILE_H = 120

// One tile as a CSS background-image (an SVG data URI): light text with a
// dark outline, readable on any photo, light or dark.
export function watermarkTile(label) {
  const text = escapeXml(label)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}">` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" transform="rotate(-24 ${TILE_W / 2} ${TILE_H / 2})" ` +
    `font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff" fill-opacity="0.26" ` +
    `stroke="#3b1f4a" stroke-opacity="0.3" stroke-width="0.8">${text}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
