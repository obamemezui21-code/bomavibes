// BomaVibes Campus: words, formats and small helpers shared by its screens,
// its reports and its tests. No network, no React.

export const STATUSES = ['P', 'R', 'A']
export const STATUS = {
  P: { label: 'Présent', plural: 'Présents' },
  R: { label: 'Retard', plural: 'Retards' },
  A: { label: 'Absent', plural: 'Absents' },
}
export const UNSET = 'Non renseigné'
export const statusLabel = (s) => STATUS[s]?.label ?? UNSET

export const SESSION_STATUS = { draft: 'En cours de saisie', validated: 'Validée', cancelled: 'Annulée' }
export const ROLE_LABELS = { admin: 'Administrateur', agent: 'Agent pédagogique', teacher: 'Enseignant' }

// 0.934 → « 93,4 % »; nothing to count → « — ».
export function percent(rate, digits = 1) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: digits })} %`
}

const utc = (date) => new Date(`${date}T00:00:00Z`)
const fmt = (date, options) => (date ? utc(date).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...options }) : '')
export const longDate = (date) => fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const mediumDate = (date) => fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const shortDate = (date) => fmt(date, { day: '2-digit', month: '2-digit', year: 'numeric' })
export const dayMonth = (date) => fmt(date, { day: 'numeric', month: 'short' })
export const monthLabel = (month) => fmt(`${month}-01`, { month: 'long', year: 'numeric' })
export const monthShort = (month) => fmt(`${month}-01`, { month: 'short', year: '2-digit' })
export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
export const hours = (s) => `${s.start} – ${s.end}`

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export function addDays(date, n) {
  const d = utc(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// The Monday of a date's week; null if it isn't a date.
export function mondayOf(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(utc(date).getTime())) return null
  return addDays(date, -((utc(date).getUTCDay() + 6) % 7))
}

// The first and last day of a « 2026-11 ».
export function monthBounds(month) {
  const [y, m] = month.split('-').map(Number)
  return { from: `${month}-01`, to: `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}` }
}

// « 2026-2027 » and the three before it.
export function academicYears(current, count = 4) {
  const y = Number(current.slice(0, 4))
  return Array.from({ length: count }, (_, i) => `${y - i}-${y - i + 1}`)
}

// Accents, capitals and punctuation aside: for searching only.
export function searchKey(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Every word typed is found at the start of a word of the name (any order),
// or the number is the one typed.
export function matchesSearch(query, { name, no, id }) {
  const q = searchKey(query)
  if (!q) return true
  if (/^\d+$/.test(q)) return String(no ?? '') === q
  if (id && searchKey(id).replace(/ /g, '') === q.replace(/ /g, '')) return true
  const words = searchKey(name).split(' ')
  return q.split(' ').every((part) => words.some((w) => w.startsWith(part)))
}

export function countMarks(roster, marks) {
  const c = { p: 0, r: 0, a: 0, n: 0 }
  for (const s of roster) {
    const v = marks[s.id]?.s
    if (v === 'P') c.p++
    else if (v === 'R') c.r++
    else if (v === 'A') c.a++
    else c.n++
  }
  return c
}

export const TRASH_LABELS = { session: 'Feuille de présence', student: 'Étudiant', class: 'Classe', timetable: 'Planning', subject: 'Matière', teacher: 'Enseignant' }

const FIELD = { code: 'Code', no: 'Numéro', date: 'Date', start: 'Début', end: 'Fin', subject: 'Matière', teacher: 'Enseignant', name: 'Nom', active: 'Actif', role: 'Rôle', status: 'Statut', canExport: 'Export', label: 'Intitulé', expected: 'Effectif', kind: 'Type' }
const show = (k, v) => (v === null || v === undefined || v === '' ? '—' : v === true ? 'oui' : v === false ? 'non' : k === 'date' ? shortDate(v) : k === 'role' ? ROLE_LABELS[v] || v : k === 'kind' ? (v === 'evaluation' ? 'Évaluation' : 'Cours') : k === 'status' ? SESSION_STATUS[v] || v : String(v))

function diff(from, to) {
  return Object.keys(to || {})
    .filter((k) => (from?.[k] ?? null) !== to[k])
    .map((k) => `${FIELD[k] || k} : ${show(k, from?.[k])} → ${show(k, to[k])}`)
}

// One line of the log → { title, lines }.
export function describeAudit(e) {
  const d = e.details || {}
  switch (e.action) {
    case 'session.create':
      return { title: 'Séance créée', lines: [`${d.subject}, ${d.teacher}, ${shortDate(d.date)} ${d.start} – ${d.end}`] }
    case 'session.update':
      return { title: 'Séance modifiée', lines: diff(e.from, e.to) }
    case 'session.validate':
      return { title: 'Feuille validée', lines: [`${d.p} présents, ${d.r} retards, ${d.a} absents, ${d.n} non renseignés`] }
    case 'session.cancel':
      return { title: 'Feuille annulée (conservée dans les archives)', lines: diff(e.from, e.to) }
    case 'session.roster':
      return { title: 'Liste de la feuille mise à jour', lines: [`${d.before} → ${d.after} étudiants`] }
    case 'marks.update':
      return { title: 'Statuts modifiés avant validation', lines: (e.changes || []).map((c) => (c.from === c.to ? `${c.name} : motif « ${c.noteFrom || '—'} » → « ${c.noteTo || '—'} »` : `${c.name} : ${statusLabel(c.from)} → ${statusLabel(c.to)}`)) }
    case 'marks.correct': {
      const lines = [`${e.studentName} : ${statusLabel(e.from?.s)} → ${statusLabel(e.to?.s)}`]
      if ((e.from?.n || '') !== (e.to?.n || '')) lines.push(`Motif d’absence : « ${e.from?.n || '—'} » → « ${e.to?.n || '—'} »`)
      return { title: 'Correction après validation', lines }
    }
    case 'timetable.save':
      return { title: `Planning modifié, semaine du ${shortDate(e.week)}`, lines: d.changes || [] }
    case 'timetable.publish':
      return { title: `Planning publié, semaine du ${shortDate(e.week)}`, lines: [] }
    case 'timetable.unpublish':
      return { title: `Planning remis en brouillon, semaine du ${shortDate(e.week)}`, lines: [] }
    case 'timetable.copy':
      return { title: `Planning repris, semaine du ${shortDate(e.week)}`, lines: [`Depuis la semaine du ${shortDate(d.from)}`] }
    case 'slot.cancel':
      return { title: 'Cours marqué annulé', lines: [`${d.course}, ${shortDate(d.date)} ${d.start}`] }
    case 'slot.restore':
      return { title: 'Cours rétabli', lines: [`${d.course}, ${shortDate(d.date)} ${d.start}`] }
    case 'session.delete':
    case 'student.delete':
    case 'class.delete':
    case 'timetable.delete':
    case 'subject.delete':
    case 'teacher.delete':
      return { title: `${TRASH_LABELS[e.action.split('.')[0]]} : mis à la corbeille`, lines: [d.label] }
    case 'trash.restore':
      return { title: 'Restauré depuis la corbeille', lines: [`${TRASH_LABELS[d.type] || ''} : ${d.label}`] }
    case 'trash.purge':
      return { title: 'Supprimé définitivement', lines: [`${TRASH_LABELS[d.type] || ''} : ${d.label}`] }
    case 'session.reopen':
      return { title: 'Feuille rouverte à la saisie', lines: [`${d.p} présents, ${d.r} retards, ${d.a} absents, ${d.n} non renseignés`] }
    case 'session.restore':
      return { title: 'Feuille annulée rétablie', lines: diff(e.from, e.to) }
    case 'session.students':
      return { title: 'Étudiants de la feuille modifiés', lines: [...(d.added || []).map((n) => `Ajouté : ${n}`), ...(d.removed || []).map((r) => `Retiré : ${r.name} (${statusLabel(r.s)}${r.n ? `, « ${r.n} »` : ''})`)] }
    case 'scan.add':
      return { title: 'Feuille papier ajoutée', lines: [d.name] }
    case 'scan.remove':
      return { title: 'Feuille papier retirée', lines: [`${d.name}${d.addedBy ? ` (ajoutée par ${d.addedBy})` : ''}`] }
    case 'roster.import':
      return { title: 'Liste officielle importée', lines: [`${d.added} ajoutés, ${d.kept} conservés, ${d.renamed} orthographes corrigées, ${d.archived} archivés`] }
    case 'student.add':
      return { title: 'Étudiant ajouté', lines: [e.studentName] }
    case 'student.update':
      return { title: `Étudiant modifié : ${e.studentName}`, lines: diff(e.from, e.to) }
    case 'class.create':
      return { title: 'Classe créée', lines: [`${d.code} – ${d.label}, ${d.expected} étudiants attendus`] }
    case 'class.update':
      return { title: 'Classe modifiée', lines: diff(e.from, e.to) }
    case 'subject.add':
      return { title: 'Matière ajoutée', lines: [d.name] }
    case 'teacher.add':
      return { title: 'Enseignant ajouté', lines: [d.name] }
    case 'subject.update':
      return { title: 'Matière modifiée', lines: diff(e.from, e.to) }
    case 'teacher.update':
      return { title: 'Enseignant modifié', lines: diff(e.from, e.to) }
    case 'member.set':
      return { title: `Accès accordé : ${e.to?.name || ''}`, lines: diff(e.from, e.to) }
    case 'member.remove':
      return { title: `Accès retiré : ${e.from?.name || ''}`, lines: [] }
    default:
      return { title: e.action, lines: [] }
  }
}
