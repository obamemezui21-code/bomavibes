// The writing styles a member can pick in Paramètres. Each one sets the app's
// two font variables (--font-sans for the text, --font-display for the titles)
// through a [data-font] rule in index.css, on <html> for the whole app and on
// each row of the picker for its preview. It's kept on the member's account
// (users/{uid}.font, see FontSync.jsx) and on the device, where index.html
// applies it before the first paint.
//
// Fonts ship with the app (no outside service) and are only downloaded when
// used: a member fetches their own, the rest wait for the picker to open.

export const FONT_STORAGE_KEY = 'bomavibes-font'
export const DEFAULT_FONT = 'default'

export const FONT_CATEGORIES = ['Moderne', 'Arrondie', 'Élégante', 'Manuscrite', 'Machine à écrire', 'Facile à lire']

export const FONTS = [
  { id: DEFAULT_FONT, name: 'BomaVibes', note: 'Par défaut', category: 'Moderne' },
  {
    id: 'poppins',
    name: 'Poppins',
    category: 'Moderne',
    load: () => Promise.all([import('@fontsource/poppins/latin-400.css'), import('@fontsource/poppins/latin-600.css'), import('@fontsource/poppins/latin-700.css')]),
  },
  {
    id: 'nunito',
    name: 'Nunito',
    category: 'Arrondie',
    load: () => Promise.all([import('@fontsource/nunito/latin-400.css'), import('@fontsource/nunito/latin-600.css'), import('@fontsource/nunito/latin-800.css')]),
  },
  {
    id: 'fredoka',
    name: 'Fredoka',
    category: 'Arrondie',
    load: () => Promise.all([import('@fontsource/fredoka/latin-400.css'), import('@fontsource/fredoka/latin-600.css')]),
  },
  {
    id: 'playfair',
    name: 'Playfair',
    category: 'Élégante',
    load: () => Promise.all([import('@fontsource/playfair-display/latin-700.css'), import('@fontsource/lora/latin-400.css'), import('@fontsource/lora/latin-600.css')]),
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    category: 'Élégante',
    load: () => Promise.all([import('@fontsource/merriweather/latin-400.css'), import('@fontsource/merriweather/latin-700.css')]),
  },
  {
    id: 'plume',
    name: 'Plume',
    category: 'Manuscrite',
    load: () => Promise.all([import('@fontsource/dancing-script/latin-700.css'), import('@fontsource/patrick-hand/latin-400.css')]),
  },
  {
    id: 'cahier',
    name: 'Cahier',
    category: 'Manuscrite',
    load: () => import('@fontsource/patrick-hand/latin-400.css'),
  },
  {
    id: 'machine',
    name: 'Machine',
    category: 'Machine à écrire',
    load: () => Promise.all([import('@fontsource/courier-prime/latin-400.css'), import('@fontsource/courier-prime/latin-700.css')]),
  },
  {
    id: 'atkinson',
    name: 'Atkinson',
    category: 'Facile à lire',
    load: () => Promise.all([import('@fontsource/atkinson-hyperlegible/latin-400.css'), import('@fontsource/atkinson-hyperlegible/latin-700.css')]),
  },
  {
    id: 'lexend',
    name: 'Lexend',
    category: 'Facile à lire',
    load: () => Promise.all([import('@fontsource/lexend/latin-400.css'), import('@fontsource/lexend/latin-600.css'), import('@fontsource/lexend/latin-700.css')]),
  },
]

export function fontById(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0]
}

export function fontsByCategory() {
  return FONT_CATEGORIES.map((category) => ({ category, fonts: FONTS.filter((f) => f.category === category) }))
}

// The font family for text drawn on a canvas, which can't read CSS variables.
// `fallback`: what that text uses in the default style, so its look doesn't
// change for members who keep it.
let canvasFamily = { id: null, stack: '' }
export function appFont(fallback = 'system-ui, sans-serif') {
  if (typeof document === 'undefined') return fallback
  const id = document.documentElement.dataset.font
  if (!id || id === DEFAULT_FONT) return fallback
  if (canvasFamily.id !== id) {
    canvasFamily = { id, stack: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() }
  }
  return canvasFamily.stack || fallback
}

// A failed download just leaves the text in the fallback font.
export function loadFont(id) {
  return Promise.resolve(fontById(id).load?.()).catch(() => {})
}

export function loadAllFonts() {
  return Promise.all(FONTS.map((f) => loadFont(f.id)))
}
