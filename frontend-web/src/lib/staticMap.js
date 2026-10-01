// A small static map made of OpenStreetMap tiles (same source as the
// Leaflet maps), centred on a point — light enough to sit in a chat bubble
// without loading Leaflet for every message.

const TILE = 256

// Pixel position of (lat, lng) on the whole world map at `zoom` (Web Mercator).
export function worldPixel(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

// Tiles covering a width × height box centred on the point, each with its
// offset inside the box. → [{ key, url, left, top }]
export function tilesAround(lat, lng, zoom, width, height) {
  const centre = worldPixel(lat, lng, zoom)
  const originX = centre.x - width / 2
  const originY = centre.y - height / 2
  const max = 2 ** zoom
  const tiles = []
  for (let ty = Math.floor(originY / TILE); ty * TILE < originY + height; ty++) {
    for (let tx = Math.floor(originX / TILE); tx * TILE < originX + width; tx++) {
      if (ty < 0 || ty >= max) continue
      const wrappedX = ((tx % max) + max) % max
      tiles.push({
        key: `${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        left: Math.round(tx * TILE - originX),
        top: Math.round(ty * TILE - originY),
      })
    }
  }
  return tiles
}

// Opens the place in the phone's maps app (Google Maps link: works on
// Android, iOS and desktop alike).
export function mapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
