import { auth } from './config.js'

// BomaVibes Campus — attendance (backend/src/campus/). Everything goes through
// the server: the app never reads or writes these Firestore collections itself.

async function request(path, { method = 'GET', body, form } = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const headers = { Authorization: `Bearer ${idToken}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`/api/campus${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) })
  } catch {
    const err = new Error('Connexion impossible. Vérifiez votre réseau.')
    err.offline = true
    throw err
  }
  return res
}

async function call(path, options) {
  const res = await request(path, options)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message || 'Une erreur est survenue. Réessayez.')
    Object.assign(err, { status: res.status, code: data?.code, data })
    throw err
  }
  return data
}

const qs = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return q.size ? `?${q}` : ''
}
const seg = encodeURIComponent

export const fetchCampusMe = () => call('/me')
export const fetchCampus = () => call('/bootstrap')

// params: { classId, year, from, to, subjectId, teacherId, detail }
export const fetchStats = (params) => call(`/stats${qs(params)}`)

export const createClass = (body) => call('/classes', { method: 'POST', body })
export const fetchStudents = (classId) => call(`/classes/${seg(classId)}/students`).then((d) => d.students)
export const addStudent = (classId, body) => call(`/classes/${seg(classId)}/students`, { method: 'POST', body })
export const updateStudent = (id, body) => call(`/students/${seg(id)}`, { method: 'PATCH', body })
export const fetchStudent = (id, params) => call(`/students/${seg(id)}${qs(params)}`)
export const previewImport = (classId, body) => call(`/classes/${seg(classId)}/import/preview`, { method: 'POST', body })
export const runImport = (classId, body) => call(`/classes/${seg(classId)}/import`, { method: 'POST', body })
export const fetchImports = (classId) => call(`/classes/${seg(classId)}/imports`).then((d) => d.imports)

export const fetchSessions = (params) => call(`/sessions${qs(params)}`)
export const createSession = (body) => call('/sessions', { method: 'POST', body })
export const fetchSession = (id) => call(`/sessions/${seg(id)}`)
export const updateSession = (id, body) => call(`/sessions/${seg(id)}`, { method: 'PATCH', body })
export const saveMarks = (id, changes) => call(`/sessions/${seg(id)}/marks`, { method: 'PATCH', body: { changes } })
export const validateSession = (id, body) => call(`/sessions/${seg(id)}/validate`, { method: 'POST', body })
export const correctMark = (id, body) => call(`/sessions/${seg(id)}/corrections`, { method: 'POST', body })
export const cancelSession = (id, reason) => call(`/sessions/${seg(id)}/cancel`, { method: 'POST', body: { reason } })
export const syncRoster = (id) => call(`/sessions/${seg(id)}/roster`, { method: 'POST', body: {} })
export const fetchSessionAudit = (id) => call(`/sessions/${seg(id)}/audit`).then((d) => d.entries)

export function addScan(id, file) {
  const form = new FormData()
  form.append('file', file)
  return call(`/sessions/${seg(id)}/scans`, { method: 'POST', form })
}
export const removeScan = (id, scanId) => call(`/sessions/${seg(id)}/scans/${seg(scanId)}`, { method: 'DELETE' })
// The image itself, as a Blob (private: it needs the account's token).
export async function fetchScan(id, scanId) {
  const res = await request(`/sessions/${seg(id)}/scans/${seg(scanId)}`)
  if (!res.ok) throw new Error('Image introuvable.')
  return res.blob()
}

// The weekly timetable. week: its Monday, YYYY-MM-DD.
export const fetchAgenda = (params) => call(`/agenda${qs(params)}`)
export const fetchTimetable = (params) => call(`/timetable${qs(params)}`)
export const saveTimetable = (body) => call('/timetable', { method: 'PUT', body })
export const publishTimetable = (body) => call('/timetable/status', { method: 'POST', body })
export const copyTimetable = (body) => call('/timetable/copy', { method: 'POST', body })
export const cancelSlot = (body) => call('/timetable/cancel', { method: 'POST', body })
export const openSlot = (body) => call('/timetable/open', { method: 'POST', body })
export const openDay = (body) => call('/timetable/open-day', { method: 'POST', body })
export const fetchBlankSheets = (params) => call(`/timetable/blank${qs(params)}`)

// kind: 'subjects' | 'teachers'
export const addNamed = (kind, name) => call(`/${kind}`, { method: 'POST', body: { name } })
export const updateNamed = (kind, id, body) => call(`/${kind}/${seg(id)}`, { method: 'PATCH', body })

// The administrator's. Deleting goes to the bin: fetchTrash, restoreTrash, purgeTrash.
export const deleteSession = (id, reason) => call(`/sessions/${seg(id)}/delete`, { method: 'POST', body: { reason } })
export const reopenSession = (id, reason) => call(`/sessions/${seg(id)}/reopen`, { method: 'POST', body: { reason } })
export const restoreSession = (id, reason) => call(`/sessions/${seg(id)}/restore`, { method: 'POST', body: { reason } })
export const updateSheetStudents = (id, body) => call(`/sessions/${seg(id)}/students`, { method: 'POST', body })
export const deleteStudent = (id, body) => call(`/students/${seg(id)}/delete`, { method: 'POST', body })
export const updateClass = (id, body) => call(`/classes/${seg(id)}`, { method: 'PATCH', body })
export const deleteClass = (id, reason) => call(`/classes/${seg(id)}/delete`, { method: 'POST', body: { reason } })
export const deleteTimetable = (body) => call('/timetable/delete', { method: 'POST', body })
export const renameNamed = (kind, id, name) => call(`/${kind}/${seg(id)}/rename`, { method: 'POST', body: { name } })
export const deleteNamed = (kind, id, body) => call(`/${kind}/${seg(id)}/delete`, { method: 'POST', body })
export const fetchTrash = () => call('/trash').then((d) => d.items)
export const restoreTrash = (id) => call(`/trash/${seg(id)}/restore`, { method: 'POST', body: {} })
export const purgeTrash = (id) => call(`/trash/${seg(id)}/purge`, { method: 'POST', body: { confirmed: true } })

export const fetchMembers = () => call('/members').then((d) => d.members)
export const setMember = (body) => call('/members', { method: 'POST', body })
export const removeMember = (uid) => call(`/members/${seg(uid)}`, { method: 'DELETE' })
export const fetchAudit = () => call('/audit').then((d) => d.entries)
