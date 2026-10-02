import { Map as MapIcon } from 'lucide-react'
import { openCookieSettings, saveConsent } from '../../lib/cookieConsent.js'

// Shown instead of a map until the visitor allows the OpenStreetMap tiles
// (they receive the visitor's IP address — see lib/cookieConsent.js).
function MapConsentPlaceholder({ height = '300px' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-ink/[0.03] p-6 text-center"
      style={{ height }}
    >
      <MapIcon size={28} className="text-violet-500" />
      <p className="max-w-xs text-sm text-ink-soft">
        La carte est fournie par OpenStreetMap, qui recevra votre adresse IP.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => saveConsent({ maps: true })}
          className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Afficher les cartes
        </button>
        <button
          type="button"
          onClick={openCookieSettings}
          className="rounded-full px-3 py-2 text-sm font-medium text-violet-600 hover:underline"
        >
          Gérer les cookies
        </button>
      </div>
    </div>
  )
}

export default MapConsentPlaceholder
