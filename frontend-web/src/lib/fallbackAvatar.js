import { createAvatar } from '@dicebear/core'
import * as personas from '@dicebear/personas'

// Illustrated avatar for someone without a photo — the same Dicebear
// "personas" drawings as before, but generated right here instead of
// fetched from api.dicebear.com, so no visitor data goes to a third party.
const cache = new Map()

export function fallbackAvatar(seed, backgroundColor = 'f3e8ff,fce7f3,ede9fe') {
  const key = `${seed}|${backgroundColor}`
  let uri = cache.get(key)
  if (!uri) {
    uri = createAvatar(personas, { seed: String(seed || 'BomaVibes'), backgroundColor: backgroundColor.split(',') }).toDataUri()
    cache.set(key, uri)
  }
  return uri
}
