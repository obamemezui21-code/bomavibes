import { auth } from './config.js'

// The member's position and the distances to other members — see
// backend/src/controllers/locationController.js. Positions stay on the
// server: only rounded distances ("à 5 km de toi") come back.

async function api(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.message || 'request failed')
    err.status = res.status
    throw err
  }
  return body
}

export function saveLocation(lat, lng) {
  return api('/api/location', { method: 'POST', body: JSON.stringify({ lat, lng }) })
}

export function deleteLocation() {
  return api('/api/location', { method: 'DELETE' })
}

// → { located, distances: { [uid]: { km, label } } } — at most 60 uids
export function fetchDistances(uids) {
  return api('/api/location/distances', { method: 'POST', body: JSON.stringify({ uids }) })
}
