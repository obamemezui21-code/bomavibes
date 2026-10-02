import { useSyncExternalStore } from 'react'

// The visitor's cookie / tracker choices (RGPD, CNIL, German TTDSG).
// Everything BomaVibes needs to work (session, security checks, the
// visitor's own settings) is exempt from consent. The only optional item
// today is third-party content that receives the visitor's IP address:
// the OpenStreetMap tiles of the maps. Bump VERSION when a new category is
// added so everyone is asked again.
const KEY = 'bomavibes-cookie-consent'
const VERSION = 1
const OPEN_EVENT = 'bomavibes:cookie-settings'
// The CNIL recommends asking again after 13 months.
const MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000

const listeners = new Set()
let cached

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (parsed?.version !== VERSION) return null
    const age = Date.now() - Date.parse(parsed.decidedAt || 0)
    return age < MAX_AGE_MS ? parsed : null
  } catch {
    return null
  }
}

function emit() {
  cached = read()
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  // Another tab changed the choice.
  const onStorage = (e) => e.key === KEY && emit()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot() {
  if (cached === undefined) cached = read()
  return cached
}

export function saveConsent({ maps }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, maps: !!maps, decidedAt: new Date().toISOString() }))
  } catch {
    // private mode: the choice lasts for this page only
    cached = { version: VERSION, maps: !!maps }
    listeners.forEach((l) => l())
    return
  }
  emit()
}

// { decided, maps } — `decided` is false until the visitor has chosen.
export function useCookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return { decided: !!consent, maps: !!consent?.maps }
}

// "Gérer les cookies" links anywhere in the app reopen the banner.
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onOpenCookieSettings(handler) {
  window.addEventListener(OPEN_EVENT, handler)
  return () => window.removeEventListener(OPEN_EVENT, handler)
}
