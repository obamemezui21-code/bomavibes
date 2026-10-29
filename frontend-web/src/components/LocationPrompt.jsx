import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, MapPin, X } from 'lucide-react'
import { LOCATION_ERRORS, locationPermission, shareLocation } from '../lib/geolocation.js'
import { useToast } from '../context/ToastContext.jsx'

const DISMISS_KEY = 'bv.location.dismissedAt'
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000

function dismissedRecently() {
  try {
    return Date.now() - (Number(localStorage.getItem(DISMISS_KEY)) || 0) < DISMISS_FOR_MS
  } catch {
    return false
  }
}

// On Discover: offers to share the member's position for "à 5 km de toi".
// When it's already allowed, the position is refreshed silently and nothing
// shows. The browser's own prompt only appears after the member taps the
// button, once they've read what it's for.
function LocationPrompt() {
  const { showToast } = useToast()
  const [state, setState] = useState('hidden') // hidden | offer | asking | error
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    locationPermission().then((permission) => {
      if (!live) return
      if (permission === 'granted') shareLocation()
      else if (permission === 'prompt' && !dismissedRecently()) setState('offer')
    })
    return () => {
      live = false
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // private mode: it'll be offered again next time
    }
    setState('hidden')
  }

  async function activate() {
    setState('asking')
    const result = await shareLocation({ ask: true })
    if (result.ok) {
      setState('hidden')
      showToast('Position activée : tu vois maintenant à quelle distance sont les profils.', 'success')
    } else {
      setError(LOCATION_ERRORS[result.reason] || LOCATION_ERRORS.unavailable)
      setState('error')
    }
  }

  return (
    <AnimatePresence>
      {state !== 'hidden' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="relative mx-4 mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-3.5 pr-10 dark:border-violet-500/30 dark:bg-violet-500/10"
          role="region"
          aria-label="Activer la position"
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/70 transition hover:bg-ink/5"
            aria-label="Plus tard"
          >
            <X size={16} />
          </button>
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
            <MapPin size={15} className="text-violet-600" aria-hidden="true" /> Vois qui est près de toi
          </p>
          {state === 'error' ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft" role="alert">
              {error}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Active ta position pour voir « à 5 km de toi » sur les profils.
              </p>
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-ink-soft/70">
                <Lock size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                Ta position exacte n’est jamais montrée : les autres voient seulement une distance arrondie, et tu peux la masquer dans les réglages.
              </p>
              <button
                type="button"
                onClick={activate}
                disabled={state === 'asking'}
                className="mt-2.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/25 disabled:opacity-60"
              >
                {state === 'asking' ? 'Recherche de ta position…' : 'Activer ma position'}
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LocationPrompt
