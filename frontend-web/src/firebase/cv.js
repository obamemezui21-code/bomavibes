import { auth } from './config.js'

// CV PNPE (backend/src/controllers/cvController.js). Each call answers the
// page's state: { form, cv, status, error, remainingToday, dailyLimit, available }.

async function authedFetch(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || 'Une erreur est survenue. Réessayez.')
  return body
}

export function fetchCv() {
  return authedFetch('/api/cv')
}

// Saves without the AI (no daily quota): the form, the edited CV, or both.
export function saveCv(patch) {
  return authedFetch('/api/cv', { method: 'PUT', body: JSON.stringify(patch) })
}

// Starts writing; the result comes through fetchCv() (status "ready").
export function generateCv(form) {
  return authedFetch('/api/cv/generate', { method: 'POST', body: JSON.stringify({ form }) })
}
