// The invitation a visitor arrived with (?ref=CODE, see backend
// referralService.js), kept until they have an account and it's been sent.
// Only the code is kept, and it says nothing about who invited them.

const KEY = 'bomavibes-ref'
const KEEP_MS = 30 * 24 * 60 * 60 * 1000
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

// Reads the address once, when the app starts. The first invitation stays.
export function captureReferral(search = window.location.search, now = Date.now()) {
  try {
    const code = new URLSearchParams(search).get('ref')
    if (!code || !CODE.test(code) || pendingReferral(now)) return
    localStorage.setItem(KEY, JSON.stringify({ code, at: now }))
  } catch {
    // private mode: the invitation just isn't remembered
  }
}

export function pendingReferral(now = Date.now()) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved && CODE.test(saved.code) && now - saved.at < KEEP_MS ? saved.code : null
  } catch {
    return null
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing kept, nothing to clear
  }
}
