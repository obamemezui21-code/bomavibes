// A green counter on BomaVibes' icon in the browser tab, drawn here (so the
// colour is ours, unlike the system's badge on the installed app's icon:
// lib/appBadge.js). Same count as the bell.

export const BADGE_GREEN = '#25D366'
const SIZE = 64

let original = null // the icon's address before any counter
let logo = null
let shown = -1

function iconLink() {
  return document.querySelector('link[rel="icon"]')
}

function loadLogo(src) {
  logo ||= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
  return logo
}

export const badgeText = (count) => (count > 9 ? '9+' : String(count))

export async function setTabBadge(count) {
  if (typeof document === 'undefined') return
  const link = iconLink()
  if (!link || count === shown) return
  original ??= { href: link.href, type: link.type }
  shown = count
  if (!count) {
    link.type = original.type
    link.href = original.href
    return
  }
  try {
    const img = await loadLogo(original.href)
    if (shown !== count) return // changed while the logo loaded
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, SIZE, SIZE)
    // Large on purpose: a tab icon is shown at 16 px.
    const r = 17
    const [cx, cy] = [SIZE - r, SIZE - r]
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.fillStyle = BADGE_GREEN
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    const text = badgeText(count)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${text.length > 1 ? 19 : 25}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, cx, cy + 1)
    link.type = 'image/png'
    link.href = canvas.toDataURL('image/png')
  } catch {
    // Logo unreadable: the plain icon stays.
  }
}
