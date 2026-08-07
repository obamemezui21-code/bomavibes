// Derives a smaller-resolution URL from a full-size uploaded photo URL,
// matching the naming convention written by backend/src/controllers/
// photoController.js (photo-0.jpg / photo-0-medium.jpg / photo-0-thumb.jpg).
//
// Only ever call this on URLs uploaded through our own /api/photos endpoint
// (not dicebear avatars or other external images) — anything that doesn't
// match the pattern is returned unchanged, so it's always safe to call.
export function photoVariant(url, size) {
  if (!url || typeof url !== 'string' || size === 'full') return url
  const match = url.match(/^(.*\/photo-\d+)(\.jpg)(\?.*)?$/)
  if (!match) return url
  const [, base, ext, query] = match
  return `${base}-${size}${ext}${query || ''}`
}

// Attach to an <img>'s onError to gracefully fall back to the full-size
// photo if a smaller variant doesn't exist yet (e.g. photos uploaded
// before variants existed, until the backfill script runs).
export function fallbackToFullPhoto(originalUrl) {
  return (e) => {
    e.currentTarget.onerror = null
    e.currentTarget.src = originalUrl
  }
}
