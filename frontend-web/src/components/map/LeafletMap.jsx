import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom flat divIcon pins instead of Leaflet's default marker image —
// sidesteps a well-known Vite bug where the default icon's PNG asset paths
// break after bundling (rather than working around it with explicit image
// imports), and matches the app's own flat/rounded visual style better than
// Leaflet's default red teardrop.
const VARIANT_COLORS = {
  venue: '#62265f', // violet-600
  event: '#237a4b', // mint-600
  draft: '#c23b3b', // coral-600 — the pin an admin is currently placing
}

function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

const LIBREVILLE = [0.39, 9.45]

// A thin imperative wrapper around plain Leaflet (not react-leaflet — this
// app is on React 19 and react-leaflet's compatibility there isn't worth
// betting on; Leaflet itself has no React version dependency at all).
function LeafletMap({
  center = LIBREVILLE,
  zoom = 12,
  height = '300px',
  markers = [],
  onMarkerClick,
  onMapClick,
  draggableMarker = null,
  fitToMarkers = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersLayerRef = useRef(null)
  const draggableRef = useRef(null)
  const hasFittedRef = useRef(false)
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMapClickRef = useRef(onMapClick)

  onMarkerClickRef.current = onMarkerClick
  onMapClickRef.current = onMapClick

  useEffect(() => {
    const map = L.map(containerRef.current, { attributionControl: true }).setView(center, zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    map.on('click', (e) => onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    mapRef.current?.setView(center, zoom)
  }, [center, zoom])

  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer) return
    layer.clearLayers()
    markers.forEach((m) => {
      // A marker can bring its own HTML (e.g. an avatar pin) instead of a flat colored dot.
      const icon = m.html
        ? L.divIcon({ className: '', html: m.html, iconSize: m.iconSize, iconAnchor: m.iconSize?.map((s) => s / 2) })
        : pinIcon(VARIANT_COLORS[m.variant] || VARIANT_COLORS.venue)
      const marker = L.marker([m.lat, m.lng], { icon })
      marker.on('click', () => onMarkerClickRef.current?.(m.id))
      marker.addTo(layer)
    })
    // Frame the markers once — refitting on every update would make the map
    // jump around while the user is exploring it.
    if (fitToMarkers && markers.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true
      mapRef.current?.fitBounds(
        markers.map((m) => [m.lat, m.lng]),
        { padding: [40, 40], maxZoom: 11 },
      )
    }
  }, [markers, fitToMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (draggableRef.current) {
      map.removeLayer(draggableRef.current)
      draggableRef.current = null
    }

    if (draggableMarker) {
      const marker = L.marker([draggableMarker.lat, draggableMarker.lng], {
        icon: pinIcon(VARIANT_COLORS.draft),
        draggable: true,
      }).addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onMapClickRef.current?.({ lat: pos.lat, lng: pos.lng })
      })
      draggableRef.current = marker
    }
  }, [draggableMarker])

  return <div ref={containerRef} style={{ height, width: '100%' }} className="overflow-hidden rounded-xl" />
}

export default LeafletMap
