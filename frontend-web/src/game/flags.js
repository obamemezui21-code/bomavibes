// The flags flown in the games (and on the flyers): BomaVibes (its logo),
// Gabon, SW (Star Waz, black and white) and 2NK3 (white and black).
// paintFlag() fills a flat w × h box on a 2D canvas; callers clip it to a
// waving shape or use it as a texture.
import logoUrl from '../assets/bomavibes-logo.webp'

export const FLAG_DESIGNS = ['bomavibes', 'gabon', 'sw', '2nk3']

// Border colour around each cloth.
export const FLAG_BORDER = { bomavibes: '#fcd116', gabon: '#ffffff', sw: '#ffffff', '2nk3': '#0a0a0a' }

let logo = null
let logoLoading = false
export function flagLogoReady() {
  if (!logo && !logoLoading && typeof Image !== 'undefined') {
    logoLoading = true
    const img = new Image()
    img.onload = () => {
      logo = img
    }
    img.src = logoUrl
  }
  return !!logo
}

function word(g, text, color, x, y, w, h, size) {
  let s = h * size
  g.font = `900 ${s}px Anton, Impact, system-ui, sans-serif`
  while (s > 4 && g.measureText(text).width > w * 0.82) {
    s -= 1
    g.font = `900 ${s}px Anton, Impact, system-ui, sans-serif`
  }
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, x + w / 2, y + h * 0.54)
}

export function paintFlag(g, design, x, y, w, h) {
  if (design === 'gabon') {
    g.fillStyle = '#009e60'
    g.fillRect(x, y, w, h / 3 + 0.5)
    g.fillStyle = '#fcd116'
    g.fillRect(x, y + h / 3, w, h / 3 + 0.5)
    g.fillStyle = '#3a75c4'
    g.fillRect(x, y + (2 * h) / 3, w, h / 3)
  } else if (design === 'sw') {
    g.fillStyle = '#0a0a0a'
    g.fillRect(x, y, w, h)
    word(g, 'SW', '#ffffff', x, y, w, h, 0.62)
  } else if (design === '2nk3') {
    g.fillStyle = '#ffffff'
    g.fillRect(x, y, w, h)
    word(g, '2NK3', '#0a0a0a', x, y, w, h, 0.55)
  } else {
    g.fillStyle = '#faf6ee'
    g.fillRect(x, y, w, h)
    if (flagLogoReady()) {
      const r = Math.min((w * 0.92) / logo.width, (h * 0.96) / logo.height)
      g.drawImage(logo, x + (w - logo.width * r) / 2, y + (h - logo.height * r) / 2, logo.width * r, logo.height * r)
    } else {
      word(g, 'BOMAVIBES', '#8a5a12', x, y, w, h, 0.4)
    }
  }
}
