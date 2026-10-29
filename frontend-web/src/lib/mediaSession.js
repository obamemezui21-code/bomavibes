import { auth } from '../firebase/config.js'

// Members' photos (profile photos, chat attachments) are only served with a
// signed cookie the API hands to signed-in members (backend/src/routes/
// mediaRoutes.js, checked by nginx). It lasts 12 h: it's asked for at sign-in
// and renewed before it runs out; a photo that failed because the cookie
// wasn't there yet is reloaded once it is.

const EXP_KEY = 'bv.media.exp'
const RENEW_BEFORE_S = 4 * 60 * 60
const PROTECTED = /\/uploads\/(profile-photos|chat-attachments)\//

let pending = null

function storedExp() {
  try {
    return Number(localStorage.getItem(EXP_KEY)) || 0
  } catch {
    return 0
  }
}

function storeExp(exp) {
  try {
    if (exp) localStorage.setItem(EXP_KEY, String(exp))
    else localStorage.removeItem(EXP_KEY)
  } catch {
    // private mode: the cookie is just asked for again next time
  }
}

// Gets (or renews) the cookie when it's missing or about to expire.
// Resolves either way: a failure only means photos may not show.
export function ensureMediaSession({ force = false } = {}) {
  const user = auth.currentUser
  if (!user) return Promise.resolve()
  if (!force && storedExp() - Date.now() / 1000 > RENEW_BEFORE_S) return Promise.resolve()
  pending ||= user
    .getIdToken()
    .then((token) => fetch('/api/media/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => storeExp(body?.exp || 0))
    .catch(() => {})
    .finally(() => {
      pending = null
    })
  return pending
}

export function clearMediaSession() {
  if (!storedExp()) return Promise.resolve() // never had one (a visitor)
  storeExp(0)
  return fetch('/api/media/session', { method: 'DELETE' }).catch(() => {})
}

// One listener for every <img> of the app: a member's photo that didn't load
// (the cookie came after it, or had expired) is tried again once with a fresh
// cookie.
export function installMediaRetry() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return
      const src = img.getAttribute('src') || ''
      const base = src.replace(/[?&]m=\d+$/, '')
      // Once per photo: a file that really is missing must not loop.
      if (!PROTECTED.test(base) || img.dataset.mediaRetry === base) return
      img.dataset.mediaRetry = base
      ensureMediaSession({ force: true }).then(() => {
        if (img.getAttribute('src') !== src) return // the app has moved on to another photo
        img.src = `${base}${base.includes('?') ? '&' : '?'}m=${Date.now()}`
      })
    },
    true,
  )
}
