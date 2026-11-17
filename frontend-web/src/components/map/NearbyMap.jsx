import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import LeafletMap from './LeafletMap.jsx'
import { groupProfilesByCity } from '../../lib/nearby.js'
import { fallbackToFullPhoto } from '../../lib/photoVariants.js'
import { PIN_SIZE, avatarFor, pinHtml } from './avatarPin.js'
import { ageSuffix } from '../../lib/profileDisplay.js'

// "Autour de moi": the Discover candidates on a map, grouped per city. Pins
// sit on the city centre only (see lib/nearby.js) — never an exact position.
function NearbyMap({ profiles, onOpenProfile }) {
  const groups = useMemo(() => groupProfilesByCity(profiles), [profiles])
  const [selectedKey, setSelectedKey] = useState(null)

  const markers = useMemo(
    () =>
      groups.map((g) => ({
        id: g.key,
        lat: g.lat,
        lng: g.lng,
        html: pinHtml(g),
        iconSize: [PIN_SIZE, PIN_SIZE],
      })),
    [groups],
  )

  if (groups.length === 0) return null

  const selected = groups.find((g) => g.key === selectedKey) || groups[0]

  return (
    <div className="mt-8 w-full">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <MapPin size={16} strokeWidth={2.25} className="text-pink-500" />
          Autour de moi
        </h2>
        <span className="text-[11px] text-ink-soft/50">Position par ville uniquement</span>
      </div>

      <div className="relative z-0 mt-3 overflow-hidden rounded-2xl border border-ink/8 shadow-sm">
        <LeafletMap markers={markers} onMarkerClick={setSelectedKey} height="260px" fitToMarkers />
      </div>

      <p className="mt-3 px-1 text-xs font-semibold text-ink-soft/70">
        {selected.city} · {selected.profiles.length} profil{selected.profiles.length > 1 ? 's' : ''}
      </p>
      <div className="mt-2 flex gap-3 overflow-x-auto px-1 pb-1">
        {selected.profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenProfile(p)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <img
              src={avatarFor(p)}
              onError={p.photos?.[0] ? fallbackToFullPhoto(p.photos[0]) : undefined}
              alt={p.firstName}
              loading="lazy"
              className="h-14 w-14 rounded-full border border-white object-cover shadow-md dark:border-surface-tint"
            />
            <span className="max-w-[4rem] truncate text-xs font-medium text-ink">
              {p.firstName}
              {ageSuffix(p)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default NearbyMap
