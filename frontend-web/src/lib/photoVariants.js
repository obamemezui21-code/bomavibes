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
// Once per <img>: React calls onError again when the full photo fails too,
// and setting the same src again reloads it — that looped, and the picture
// flickered forever.
export function fallbackToFullPhoto(originalUrl) {
  return (e) => {
    const img = e.currentTarget
    if (img.dataset.fullFallback) return
    img.dataset.fullFallback = '1'
    img.src = originalUrl
  }
}
