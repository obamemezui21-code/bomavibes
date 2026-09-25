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
  if (!res.ok) {
    // The content endpoints (pages/articles/faqs/banners) return a specific
    // validation message ("Ce slug est déjà utilisé"...) that's worth
    // surfacing — existing callers that just .catch() a generic error are
    // unaffected since Error still stringifies to something sensible.
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || 'request failed')
  }
  return res.json()
}

export function fetchAdminStats() {
  return authedFetch('/api/admin/stats')
}

export function fetchAdminActivity() {
  return authedFetch('/api/admin/activity')
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

export function setAdminUserBanned(uid, banned) {
  return authedFetch(`/api/admin/users/${uid}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned }),
  })
}

export function deleteAdminPost(postId) {
  return authedFetch(`/api/admin/posts/${postId}`, { method: 'DELETE' })
}

export function fetchAdminLogs({ cursor, action } = {}) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (action) params.set('action', action)
  const query = params.toString()
  return authedFetch(`/api/admin/logs${query ? `?${query}` : ''}`)
}

// type is one of 'pages' | 'articles' | 'faqs' | 'banners' — see
// backend/src/services/contentService.js for the shared shape.
export function fetchAdminContentList(type, status = 'all') {
  return authedFetch(`/api/admin/content/${type}?status=${encodeURIComponent(status)}`)
}

export function fetchAdminContentItem(type, id) {
  return authedFetch(`/api/admin/content/${type}/${id}`)
}

export function createAdminContentItem(type, data) {
  return authedFetch(`/api/admin/content/${type}`, { method: 'POST', body: JSON.stringify(data) })
}

export function updateAdminContentItem(type, id, data) {
  return authedFetch(`/api/admin/content/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteAdminContentItem(type, id) {
  return authedFetch(`/api/admin/content/${type}/${id}`, { method: 'DELETE' })
}

export function fetchUserDirectory(filter = 'all', search = '') {
  const params = new URLSearchParams({ filter, search })
  return authedFetch(`/api/admin/directory?${params}`)
}

export function fetchUserDirectoryDetail(uid) {
  return authedFetch(`/api/admin/directory/${uid}`)
}

export function deleteDirectoryUser(uid) {
  return authedFetch(`/api/admin/directory/${uid}`, { method: 'DELETE' })
}

export function sendAdminNotificationBroadcast(payload) {
  return authedFetch('/api/admin/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchAdminAnnouncement(id) {
  return authedFetch(`/api/admin/notifications/announcements/${id}`)
}

export function updateAdminAnnouncement(id, data) {
  return authedFetch(`/api/admin/notifications/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteAdminAnnouncement(id) {
  return authedFetch(`/api/admin/notifications/announcements/${id}`, { method: 'DELETE' })
}

export function fetchCmsMedia() {
  return authedFetch('/api/admin/media')
}

// Not authedFetch: a multipart upload must let the browser set its own
// Content-Type (with the multipart boundary) — authedFetch always forces
// application/json.
export async function uploadCmsMedia(file) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('image', file, file.name)
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || 'upload failed')
  }
  return res.json()
}

export function deleteCmsMedia(name) {
  return authedFetch(`/api/admin/media/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function fetchAdminSettings() {
  return authedFetch('/api/admin/settings')
}

export function updateAdminSettings(data) {
  return authedFetch('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(data) })
}
