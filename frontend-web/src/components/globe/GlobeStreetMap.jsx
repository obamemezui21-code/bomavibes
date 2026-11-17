import { useMemo } from 'react'
import { Globe2 } from 'lucide-react'
import LeafletMap from '../map/LeafletMap.jsx'
import { PIN_SIZE, pinHtml } from '../map/avatarPin.js'

// Zoomed out this far, the globe takes back over.
const BACK_TO_GLOBE_ZOOM = 5

// The globe's last step in: a street map (OpenStreetMap) of the place it was
// facing, with cities, districts and streets. Members stay on their city's
// centre, as on the globe — never at their home. Spreading the fingers goes
// further in; bringing them together, far enough, returns to the globe.
// Loaded only when someone dives in (ActiveGlobe.jsx).
function GlobeStreetMap({ lat, lng, cities, onSelect, onBack }) {
  const center = useMemo(() => [lat, lng], [lat, lng])
  const markers = useMemo(
    () => cities.map((c) => ({ id: c.key, lat: c.lat, lng: c.lng, html: pinHtml(c), iconSize: [PIN_SIZE, PIN_SIZE] })),
    [cities],
  )

  return (
    <div className="absolute inset-0 z-40 isolate bg-[#0d0420]">
      <LeafletMap
        center={center}
        zoom={8}
        minZoom={3}
        zoomControl={false}
        height="100%"
        className="h-full w-full"
        markers={markers}
        onMarkerClick={onSelect}
        onZoomChange={(z) => z <= BACK_TO_GLOBE_ZOOM && onBack()}
      />
      {/* Back to the globe also without a pinch (computer, or maps not allowed). */}
      <button
        type="button"
        onClick={onBack}
        className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full bg-[#0d0420]/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-[#0d0420]"
      >
        <Globe2 size={14} strokeWidth={2.5} /> Globe
      </button>
      <p className="pointer-events-none absolute bottom-1 left-2 z-[1000] rounded-full bg-[#0d0420]/70 px-2 py-0.5 text-[10px] text-white/80">
        Position par ville uniquement · pince pour revenir au globe
      </p>
    </div>
  )
}

export default GlobeStreetMap
