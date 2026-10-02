import { MapPin, Navigation } from 'lucide-react'
import { mapsLink, tilesAround } from '../../lib/staticMap.js'
import { saveConsent, useCookieConsent } from '../../lib/cookieConsent.js'

const WIDTH = 240
const HEIGHT = 140
const ZOOM = 16

// "📍 Position" bubble: a small map centred on the shared point; tapping it
// opens the place (and the route to it) in the phone's maps app.
function LocationMessage({ location, fromMe }) {
  const { lat, lng, accuracy } = location
  const { maps } = useCookieConsent()
  // OpenStreetMap tiles only with the visitor's consent (cookie banner).
  const tiles = maps ? tilesAround(lat, lng, ZOOM, WIDTH, HEIGHT) : []

  return (
    <a
      href={mapsLink(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block overflow-hidden rounded-xl border border-ink/10 bg-white text-left shadow-sm dark:bg-surface-tint"
      style={{ width: `min(${WIDTH}px, 100%)` }}
    >
      <div className="relative overflow-hidden bg-[#e5e3df]" style={{ height: HEIGHT }}>
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute h-64 w-64 max-w-none"
            style={{ left: `calc(50% - ${WIDTH / 2}px + ${t.left}px)`, top: t.top }}
          />
        ))}
        <MapPin
          size={34}
          strokeWidth={2.25}
          fill="#ec4899"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-white drop-shadow-md"
        />
        {maps ? (
          <span className="absolute bottom-0.5 right-1 rounded bg-white/70 px-1 text-[8px] text-ink/60">© OpenStreetMap</span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              saveConsent({ maps: true })
            }}
            className="absolute inset-x-0 bottom-1.5 mx-auto w-max rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-violet-600 shadow"
          >
            Afficher la carte
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">{fromMe ? 'Ma position' : 'Position partagée'}</p>
          {accuracy ? <p className="text-[11px] text-ink-soft/60">Précision : environ {accuracy} m</p> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500/12 px-2.5 py-1 text-[11px] font-semibold text-violet-600">
          <Navigation size={11} strokeWidth={2.5} />
          Itinéraire
        </span>
      </div>
    </a>
  )
}

export default LocationMessage
