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

export function fetchAdminLogs(cursor) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return authedFetch(`/api/admin/logs${query}`)
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
