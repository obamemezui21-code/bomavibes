import { auth } from './config.js'

async function authedFetch(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error('request failed')
  return res.json()
}

export function fetchAdminStats() {
  return authedFetch('/api/admin/stats')
}

export function fetchAdminReports(status = 'pending') {
  return authedFetch(`/api/admin/reports?status=${encodeURIComponent(status)}`)
}

export function updateAdminReportStatus(id, status) {
  return authedFetch(`/api/admin/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function fetchAdminUsers() {
  return authedFetch('/api/admin/users')
}

export function updateAdminUserRole(uid, role) {
  return authedFetch(`/api/admin/users/${uid}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}
