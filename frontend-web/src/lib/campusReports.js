// BomaVibes Campus — what each document contains, whatever its format: the
// same report becomes a PDF, an Excel file or a print (campusExport.js).
//
// A report: { title, subtitle, org, className, meta: [[label, value]], tables,
//   notes: [text], signatures: [text], footer, landscape, fileName }
// A table:  { title, columns: [{ label, width, type, align }], rows: [[…]], empty }
//   type: 'text' | 'int' | 'pct' (a rate, 0 to 1, or null) | 'mark' (true: a
//   cross in a box, false: an empty box)
import { STATUS, UNSET, dateTime, hours, longDate, monthLabel, shortDate, statusLabel } from './campus.js'

export const RATE_NOTE = 'Taux de présence = (présents + retards) / statuts renseignés. Taux d’absence = absents / statuts renseignés. Seules les séances validées sont comptées ; un statut non renseigné n’est ni une présence ni une absence.'

const col = (label, width, type = 'text', align) => ({ label, width, type, align: align || (type === 'text' ? 'left' : 'center') })
const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const fileName = (...parts) => parts.map(slug).filter(Boolean).join('_')

const base = (cls, extra) => ({ org: cls.org, className: `${cls.code}${cls.label && cls.label !== cls.code ? ` – ${cls.label}` : ''}`, notes: [], signatures: [], meta: [], ...extra })

// The official list.
export function officialListReport({ cls, students, today }) {
  return base(cls, {
    title: 'Liste officielle des étudiants',
    meta: [['Effectif', String(students.length)], ['Édité le', shortDate(today)]],
    tables: [{ columns: [col('N°', 10, 'int'), col('Nom et prénom', 80), col('Identifiant technique', 36)], rows: students.map((s) => [s.no, s.name, s.id]) }],
    notes: ['Le numéro est l’ordre de la liste importée ; ce n’est pas un matricule.'],
    fileName: fileName(cls.org, cls.code, 'liste officielle'),
  })
}

// On every page: a loose second page still says which course it is.
const sessionFooter = (s) => `${s.subjectName}, ${shortDate(s.date)} ${hours(s)}`

const sessionMeta = (s) => [
  ['Date', longDate(s.date)],
  ['Horaires', hours(s)],
  ['Matière', s.subjectName],
  ['Enseignant', s.teacherName],
]

// The paper sheet, to be filled in by hand during the course.
export function blankSheetReport({ session, classLabel }) {
  return base({ org: session.org, code: session.classCode, label: classLabel }, {
    title: 'Feuille de présence',
    footer: sessionFooter(session),
    meta: [...sessionMeta(session), ['Effectif attendu', String(session.roster.length)]],
    tables: [
      {
        columns: [col('N°', 9, 'int'), col('Nom et prénom', 74), col('Présent', 15, 'mark'), col('Retard', 15, 'mark'), col('Absent', 15, 'mark'), col('Émargement / observation', 50)],
        rows: session.roster.map((r) => [r.no, r.name, false, false, false, '']),
        roomy: true,
      },
    ],
    signatures: ['L’enseignant', 'L’agent pédagogique'],
    fileName: fileName(session.org, session.classCode, 'feuille vierge', session.date, session.subjectName),
  })
}

// The sheet as entered.
export function filledSheetReport({ session, classLabel, marks = session.marks }) {
  const c = session.counts
  const rated = c.p + c.r + c.a
  return base({ org: session.org, code: session.classCode, label: classLabel }, {
    title: 'Feuille de présence',
    footer: sessionFooter(session),
    subtitle: session.status === 'validated' ? null : session.status === 'cancelled' ? 'FEUILLE ANNULÉE' : 'EN COURS DE SAISIE – NON VALIDÉE',
    meta: [
      ...sessionMeta(session),
      ['Saisie par', session.agentName],
      ['Validée', session.validatedAt ? `${dateTime(session.validatedAt)}, ${session.validatedBy}` : 'Non'],
      ['Effectif', `${session.roster.length} – ${c.p} présents, ${c.r} retards, ${c.a} absents, ${c.n} non renseignés`],
      ['Taux de présence', rated ? `${(((c.p + c.r) / rated) * 100).toFixed(1).replace('.', ',')} %` : '—'],
    ],
    tables: [
      {
        columns: [col('N°', 9, 'int'), col('Nom et prénom', 74), col('Présent', 15, 'mark'), col('Retard', 15, 'mark'), col('Absent', 15, 'mark'), col('Motif / observation', 50)],
        rows: session.roster.map((r) => {
          const m = marks[r.id] || {}
          return [r.no, r.name, m.s === 'P', m.s === 'R', m.s === 'A', [m.s ? '' : UNSET, m.n].filter(Boolean).join(' – ')]
        }),
      },
    ],
    signatures: ['L’enseignant', 'L’agent pédagogique'],
    fileName: fileName(session.org, session.classCode, 'presence', session.date, session.subjectName),
  })
}

const RATE_COLS = [col('Séances', 16, 'int'), col('Présents', 16, 'int'), col('Retards', 16, 'int'), col('Absents', 16, 'int'), col('Non rens.', 17, 'int'), col('Présence', 18, 'pct'), col('Absence', 18, 'pct')]
const rateCells = (x) => [x.sessions, x.p, x.r, x.a, x.n, x.presenceRate, x.absenceRate]

function totalsMeta(stats) {
  const t = stats.totals
  return [
    ['Effectif', String(stats.class.active)],
    ['Séances validées', String(stats.sessions)],
    ['Présences', `${t.p} présents, ${t.r} retards, ${t.a} absents, ${t.n} non renseignés`],
    ['Taux', `présence ${pct(t.presenceRate)}, absence ${pct(t.absenceRate)}`],
  ]
}
const pct = (r) => (r === null ? '—' : `${(r * 100).toFixed(1).replace('.', ',')} %`)
const period = (from, to) => (from || to ? `${from ? `du ${shortDate(from)}` : ''}${to ? ` au ${shortDate(to)}` : ''}`.trim() : null)

// One month of absences and lates, student by student, then day by day.
export function monthlyReport({ stats, month }) {
  const cls = stats.class
  const some = stats.students.filter((s) => s.a || s.r)
  return base(cls, {
    title: 'Rapport mensuel des absences',
    subtitle: monthLabel(month),
    meta: totalsMeta(stats),
    tables: [
      {
        title: 'Étudiants absents ou en retard',
        columns: [col('N°', 10, 'int'), col('Nom et prénom', 74), col('Séances', 18, 'int'), col('Absences', 18, 'int'), col('Retards', 18, 'int'), col('Taux d’absence', 24, 'pct')],
        rows: [...some].sort((x, y) => y.a - x.a || y.r - x.r || x.name.localeCompare(y.name, 'fr')).map((s) => [s.no, s.name, s.sessions, s.a, s.r, s.absenceRate]),
        empty: 'Aucune absence et aucun retard ce mois-ci.',
      },
      {
        title: 'Détail par séance',
        columns: [col('Date', 20), col('Matière', 44), col('Nom et prénom', 62), col('Statut', 18), col('Motif', 36)],
        rows: (stats.events || []).map((e) => [shortDate(e.date), e.subjectName, e.name, STATUS[e.status].label, e.note]),
        empty: 'Rien à signaler.',
      },
    ],
    notes: [RATE_NOTE],
    fileName: fileName(cls.org, cls.code, 'absences', month),
  })
}

export function studentReport({ page, history = page.record.history, filters = {} }) {
  const { student, record } = page
  return base({ org: page.org, code: page.className, label: page.classLabel }, {
    title: 'Rapport individuel de présence',
    subtitle: student.name,
    meta: [
      ['Identifiant technique', student.id],
      ['Période', period(filters.from, filters.to) || (filters.year && filters.year !== 'all' ? `Année ${filters.year}` : 'Toutes les années')],
      ['Séances enregistrées', String(record.sessions)],
      ['Bilan', `${record.p} présences, ${record.r} retards, ${record.a} absences, ${record.n} non renseignés`],
      ['Taux de présence', pct(record.presenceRate)],
    ],
    tables: [
      {
        title: 'Historique des séances',
        columns: [col('Date', 22), col('Horaires', 26), col('Matière', 50), col('Enseignant', 42), col('Statut', 24), col('Motif', 36)],
        rows: history.map((h) => [shortDate(h.date), hours(h), h.subjectName, h.teacherName, statusLabel(h.status), h.note]),
        empty: 'Aucune séance validée.',
      },
    ],
    notes: [RATE_NOTE],
    fileName: fileName(page.org, page.className, 'etudiant', student.name),
  })
}

// Every subject side by side, or one subject student by student.
export function subjectReport({ stats, subject, filters = {} }) {
  const cls = stats.class
  const bySubject = { title: 'Par matière', columns: [col('Matière', 62), ...RATE_COLS], rows: stats.subjects.map((s) => [s.name, ...rateCells(s)]), empty: 'Aucune séance validée.' }
  return base(cls, {
    title: 'Rapport statistique par matière',
    subtitle: [subject?.name, period(filters.from, filters.to)].filter(Boolean).join(' – ') || null,
    meta: totalsMeta(stats),
    landscape: true,
    tables: subject ? [bySubject, { title: `Étudiants – ${subject.name}`, columns: [col('N°', 10, 'int'), col('Nom et prénom', 74), ...RATE_COLS], rows: stats.students.map((s) => [s.no, s.name, ...rateCells(s)]) }] : [bySubject],
    notes: [RATE_NOTE],
    fileName: fileName(cls.org, cls.code, 'matieres', subject?.name, filters.from, filters.to),
  })
}

export function classReport({ stats, filters = {} }) {
  const cls = stats.class
  return base(cls, {
    title: 'Rapport général de la classe',
    subtitle: period(filters.from, filters.to) || (stats.year === 'all' ? 'Toutes les années' : `Année ${stats.year}`),
    meta: totalsMeta(stats),
    landscape: true,
    tables: [
      { title: 'Par étudiant', columns: [col('N°', 10, 'int'), col('Nom et prénom', 74), ...RATE_COLS], rows: stats.students.map((s) => [s.no, s.name, ...rateCells(s)]) },
      { title: 'Par matière', columns: [col('Matière', 84), ...RATE_COLS], rows: stats.subjects.map((s) => [s.name, ...rateCells(s)]), empty: 'Aucune séance validée.' },
      { title: 'Par mois', columns: [col('Mois', 84), ...RATE_COLS], rows: stats.months.map((m) => [monthLabel(m.month), ...rateCells(m)]), empty: 'Aucune séance validée.' },
      { title: 'Par semaine', columns: [col('Semaine du', 84), ...RATE_COLS], rows: stats.weeks.map((w) => [shortDate(w.week), ...rateCells(w)]), empty: 'Aucune séance validée.' },
    ],
    notes: [RATE_NOTE],
    fileName: fileName(cls.org, cls.code, 'rapport general', filters.from, filters.to),
  })
}
