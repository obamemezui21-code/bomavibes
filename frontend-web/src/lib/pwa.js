import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

// The installed app's state, shared by InstallPWA and UpdatePrompt:
// - can it be installed right now (Android, Windows, macOS… : the browser's
//   own prompt, kept from `beforeinstallprompt`), or only by hand (iPhone)?
// - is it already running installed?
// - is a new version waiting?
// Imported by main.jsx before the app starts: Chrome fires
// `beforeinstallprompt` early, and an event missed is gone for the visit.

let state = {
  canPrompt: false,
  installed: false,
  updateReady: false,
  // The install under way: 'idle' | 'installing' | 'done' | 'cancelled' | 'failed'.
  install: 'idle',
}
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePwa() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

// ---- Where we're running ---------------------------------------------

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

// iPadOS presents itself as a Mac: told apart by its touch screen.
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)

export const isAndroid = () => /Android/.test(ua)

// Facebook, Instagram, TikTok… open links in their own window, which has no
// "Add to Home Screen": the page has to be opened in Safari first.
export const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|Snapchat|LinkedInApp/i.test(ua)

// ---- Installation -------------------------------------------------------

let deferredPrompt = null
let installTimer = null
// The browser gives no progress and no failure signal: past this without
// `appinstalled`, the install is reported as failed.
const INSTALL_TIMEOUT_MS = 60 * 1000

if (typeof window !== 'undefined') {
  state = { ...state, installed: isStandalone() }

  window.addEventListener('beforeinstallprompt', (event) => {
    // Kept for our own button rather than the browser's mini-bar.
    event.preventDefault()
    deferredPrompt = event
    set({ canPrompt: true })
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    clearTimeout(installTimer)
    set({ canPrompt: false, installed: true, install: state.install === 'installing' ? 'done' : state.install })
  })

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (event) => {
    if (event.matches) set({ installed: true })
  })
}

// Shows the browser's install dialog. Resolves 'accepted', 'dismissed', or
// 'unavailable' (each prompt can be used once; the browser offers a new one later).
export async function promptInstall() {
  const event = deferredPrompt
  if (!event) {
    set({ install: 'failed' })
    return 'unavailable'
  }
  deferredPrompt = null
  set({ canPrompt: false })
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') {
      if (!state.installed) {
        set({ install: 'installing' })
        installTimer = setTimeout(() => state.install === 'installing' && set({ install: 'failed' }), INSTALL_TIMEOUT_MS)
      }
    } else set({ install: 'cancelled' })
    return outcome
  } catch {
    set({ install: 'failed' })
    return 'unavailable'
  }
}

// ---- New versions -------------------------------------------------------

let applyUpdate = null
const UPDATE_CHECK_MS = 30 * 60 * 1000

// Registers the service worker (after the page has loaded, so it never
// competes with the app's own files). Checks for a new version on return to
// the app and every 30 min while it's open: an installed app can stay open
// for days without a reload.
export function startPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  applyUpdate = registerSW({
    onNeedRefresh() {
      set({ updateReady: true })
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) registration.update().catch(() => {})
      }
      setInterval(check, UPDATE_CHECK_MS)
      document.addEventListener('visibilitychange', check)
    },
  })
}

// Switches to the waiting version, then reloads the page on it.
export function installUpdate() {
  set({ updateReady: false })
  if (applyUpdate) applyUpdate(true)
  else window.location.reload()
}

export function resetInstall() {
  clearTimeout(installTimer)
  set({ install: 'idle' })
}
