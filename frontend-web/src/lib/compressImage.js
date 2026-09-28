// Phone photos can exceed the backend's 8MB upload limit (see
// backend/src/routes/photoRoutes.js). The server never keeps more than
// 1080px wide anyway, so we downscale to MAX_DIMENSION and re-encode as
// JPEG before sending: uploads stay small and fast on mobile data.
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85
// Already-small files go through untouched to avoid a needless re-encode.
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024

export function scaledSize(width, height, maxDimension = MAX_DIMENSION) {
  const longest = Math.max(width, height)
  if (longest <= maxDimension) return { width, height }
  const ratio = maxDimension / longest
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

// Resolves to a JPEG File, or to the original file whenever compression
// isn't possible or useful (tiny file, format the browser can't decode such
// as HEIC on Chrome, missing canvas APIs) — the server then handles it as before.
export async function compressImage(file) {
  if (!file || file.size <= SKIP_BELOW_BYTES) return file
  if (typeof createImageBitmap !== 'function') return file

  try {
    // 'from-image' applies the EXIF orientation so portrait photos stay upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = scaledSize(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    // JPEG has no transparency: paint white under PNGs instead of black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
