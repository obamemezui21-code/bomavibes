// HD profile photos are mandatory: the shorter side of every profile photo
// must be at least MIN_PHOTO_SIDE pixels. The server enforces it on upload
// and reports the member's older photos that aren't HD
// (backend/src/config/photoQuality.js — keep both in sync).
export const MIN_PHOTO_SIDE = 720

// Every profile has at least this many photos (3 at most), and each one is
// checked by the server on upload: a real photo of a person, face visible
// (backend/src/services/photoAnalysis.js).
export const MIN_PROFILE_PHOTOS = 2

// Members whose photos break the rules (not HD, not a real photo of them,
// fewer than MIN_PROFILE_PHOTOS) have until then to fix them; after that their
// account is suspended until they do: the app only opens their profile page,
// they're hidden from Discover and can't like (backend PHOTO_DEADLINE_MS).
export const PHOTO_DEADLINE = new Date('2026-10-21T23:59:59+01:00')

export const PHOTO_NOT_HD_MESSAGE = `Photo trop petite : il faut une photo HD d'au moins ${MIN_PHOTO_SIDE} pixels de côté. Prends-en une nouvelle avec ton téléphone plutôt qu'une capture d'écran ou une image reçue sur WhatsApp.`

export function isHdSize(width, height) {
  return Math.min(width, height) >= MIN_PHOTO_SIDE
}

// Checked as soon as a photo is picked. Resolves to false only when the
// photo is known to be too small: a format the browser can't decode (HEIC on
// Chrome…) is left for the server to judge.
export async function isHdPhoto(file) {
  if (typeof createImageBitmap !== 'function') return true
  try {
    const bitmap = await createImageBitmap(file)
    const hd = isHdSize(bitmap.width, bitmap.height)
    bitmap.close?.()
    return hd
  } catch {
    return true
  }
}

export function formatDeadline(date = PHOTO_DEADLINE) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
