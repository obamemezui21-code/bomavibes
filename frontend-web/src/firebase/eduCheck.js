import { auth } from './config.js'

// EDU-CHECK — the homework-analysis assistant (backend/src/eduCheck/). The
// analyses run on the server; the app only sends the text and reads results.

async function call(path, { method = 'GET', body, form } = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const headers = { Authorization: `Bearer ${idToken}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api/edu-check${path}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message || 'Une erreur est survenue. Réessayez.')
    err.status = res.status
    throw err
  }
  return data
}

// → { allowed, role, org, limits, levels, checks, disclaimer, sourceVerification, ai }
export const fetchEduAccess = () => call('/me')

// A PDF / DOCX / TXT → { text, words, kind, language } (the file isn't kept).
export function parseHomeworkFile(file) {
  const form = new FormData()
  form.append('file', file)
  return call('/parse', { method: 'POST', form })
}

// → { id }; the analysis then runs on the server (fetchAnalysis to follow it).
export const startAnalysis = ({ text, meta, checks, priorTexts }) => call('/analyses', { method: 'POST', body: { text, meta, checks, priorTexts } })

export const fetchAnalysis = (id) => call(`/analyses/${encodeURIComponent(id)}`)

export const deleteAnalysis = (id) => call(`/analyses/${encodeURIComponent(id)}`, { method: 'DELETE' })

// filters: { student, className, subject, teacher, from, to, band }
export function fetchAnalyses(filters = {}) {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
  return call(`/analyses${q.size ? `?${q}` : ''}`)
}

export const fetchDashboard = () => call('/dashboard')

// texts: [{ label, text }] (2 to 5) → the comparison, not stored.
export const compareHomework = (texts) => call('/compare', { method: 'POST', body: { texts } })
