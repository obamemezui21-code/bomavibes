// Styles for text-only posts (Facebook / WhatsApp-style coloured posts).
// A post stores only preset ids — `background` and `font` — never raw CSS,
// so nothing arbitrary from Firestore ever reaches a style attribute.

// Coloured backgrounds only fit short texts (like Facebook's).
export const MAX_BACKGROUND_TEXT = 280

export const POST_BACKGROUNDS = [
  { id: 'plum', label: 'Prune', css: 'linear-gradient(135deg, #4b164c 0%, #8a4d8b 100%)', text: '#ffffff' },
  { id: 'night', label: 'Nuit', css: 'linear-gradient(135deg, #1c1024 0%, #4b164c 100%)', text: '#ffffff' },
  { id: 'rose', label: 'Rose', css: 'linear-gradient(135deg, #dd88cf 0%, #f3d3ed 100%)', text: '#4b164c' },
  { id: 'cherry', label: 'Cerise', css: 'linear-gradient(135deg, #b3261e 0%, #dd88cf 100%)', text: '#ffffff' },
  { id: 'sunset', label: 'Coucher de soleil', css: 'linear-gradient(135deg, #f2726c 0%, #f2bf4e 100%)', text: '#2b1a2c' },
  { id: 'gold', label: 'Or', css: 'linear-gradient(135deg, #f2bf4e 0%, #f7e3a3 100%)', text: '#3a2a05' },
  { id: 'forest', label: 'Forêt', css: 'linear-gradient(135deg, #1f6b44 0%, #4dbf85 100%)', text: '#ffffff' },
  { id: 'ocean', label: 'Océan', css: 'linear-gradient(135deg, #1e5aa8 0%, #38a9e0 100%)', text: '#ffffff' },
  { id: 'sand', label: 'Sable', css: '#f7efe2', text: '#2b1a2c' },
]

export const POST_FONTS = [
  { id: 'normal', label: 'Normal', family: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif', weight: 500 },
  { id: 'bold', label: 'Gras', family: '"Outfit Variable", Outfit, ui-sans-serif, system-ui, sans-serif', weight: 800 },
  { id: 'elegant', label: 'Élégant', family: '"Playfair Display", Georgia, serif', weight: 600 },
  { id: 'script', label: 'Manuscrit', family: '"Dancing Script", cursive', weight: 700 },
  { id: 'typewriter', label: 'Machine', family: '"Courier Prime", "Courier New", monospace', weight: 700 },
]

const BACKGROUNDS_BY_ID = Object.fromEntries(POST_BACKGROUNDS.map((b) => [b.id, b]))
const FONTS_BY_ID = Object.fromEntries(POST_FONTS.map((f) => [f.id, f]))

// Unknown / missing ids resolve to "no style", so old posts and any future
// preset removal degrade to a plain text post.
export function postBackground(id) {
  return BACKGROUNDS_BY_ID[id] || null
}

export function postFont(id) {
  return FONTS_BY_ID[id] || null
}

export function hasCustomStyle(post) {
  return !!(postBackground(post?.background) || (post?.font && post.font !== 'normal' && postFont(post.font)))
}

// Bigger text for shorter posts on a coloured background.
export function backgroundTextSize(length) {
  if (length <= 60) return 'text-[26px] leading-tight'
  if (length <= 120) return 'text-[22px] leading-snug'
  if (length <= 200) return 'text-lg leading-snug'
  return 'text-base leading-relaxed'
}

// The three decorative fonts are only downloaded once someone actually
// sees or writes a styled post, not on every page load — from our own
// server, not Google Fonts.
let fontsRequested = false
export function loadPostFonts() {
  if (fontsRequested || typeof document === 'undefined') return
  fontsRequested = true
  import('@fontsource/playfair-display/600.css')
  import('@fontsource/dancing-script/700.css')
  import('@fontsource/courier-prime/700.css')
}
