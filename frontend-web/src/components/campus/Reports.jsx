import { useEffect, useState } from 'react'
import { fetchStats, fetchStudent, fetchStudents } from '../../firebase/campus.js'
import { matchesSearch, monthBounds } from '../../lib/campus.js'
import { classReport, monthlyReport, officialListReport, studentReport, subjectReport } from '../../lib/campusReports.js'
import { fieldClass, useCampus } from './campusContext.js'
import { Empty, ErrorNote, ExportButtons, Field, Panel, SearchBox } from './campusUi.jsx'

// Every document that can be exported or printed.
function Reports() {
  const { boot, cls, classId, year } = useCampus()
  const [month, setMonth] = useState(boot.today.slice(0, 7))
  const [subject, setSubject] = useState({ subjectId: '', from: '', to: '' })
  const [general, setGeneral] = useState({ from: '', to: '' })
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [studentId, setStudentId] = useState('')

  useEffect(() => {
    if (!classId) return undefined
    let live = true
    fetchStudents(classId)
      .then((s) => live && setStudents(s))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [classId])

  if (!cls) return <Empty>Aucune classe pour l’instant.</Empty>
  if (!boot.me.canExport) return <Empty>Votre compte permet de consulter les feuilles et les statistiques. L’export est accordé par l’administrateur.</Empty>

  const active = (students || []).filter((s) => s.active)
  const found = (students || []).filter((s) => matchesSearch(search, s))
  const inputs = (value, set, key) => ({ className: fieldClass, type: 'date', value: value[key], onChange: (e) => set((v) => ({ ...v, [key]: e.target.value })) })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Rapports et exports</h1>
        <p className="text-sm text-ink-soft">
          Classe {cls.code}, {year === 'all' ? 'toutes les années' : `année ${year}`}. La feuille d’une séance s’exporte et s’imprime depuis la séance.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 lg:grid-cols-2">
        {boot.me.staff && (
          <Panel title="Liste officielle des étudiants">
            <p className="mb-3 text-sm text-ink-soft">{active.length} étudiants, avec leur identifiant technique.</p>
            {active.length > 0 && <ExportButtons report={() => officialListReport({ cls: { ...cls, org: boot.org }, students: active, today: boot.today })} />}
          </Panel>
        )}
        <Panel title="Rapport mensuel des absences">
          <div className="mb-3">
            <Field label="Mois">
              <input type="month" className={fieldClass} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </Field>
          </div>
          <ExportButtons
            report={async () => {
              const stats = await fetchStats({ classId, year: 'all', ...monthBounds(month), detail: 1 })
              return monthlyReport({ stats, month })
            }}
          />
        </Panel>
        <Panel title="Rapport individuel d’un étudiant">
          <div className="mb-3 space-y-3">
            <SearchBox value={search} onChange={setSearch} />
            <Field label="Étudiant">
              <select className={fieldClass} value={found.some((s) => s.id === studentId) ? studentId : ''} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">{found.length ? `Choisir (${found.length})` : 'Aucun étudiant trouvé'}</option>
                {found.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.active ? '' : ' (archivé)'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {found.some((s) => s.id === studentId) ? <ExportButtons report={async () => studentReport({ page: await fetchStudent(studentId, { year }), filters: { year } })} /> : <p className="text-xs text-ink-soft">Choisissez un étudiant.</p>}
        </Panel>
        <Panel title="Rapport statistique par matière">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Field label="Matière">
              <select className={fieldClass} value={subject.subjectId} onChange={(e) => setSubject((v) => ({ ...v, subjectId: e.target.value }))}>
                <option value="">Toutes</option>
                {boot.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Du">
              <input {...inputs(subject, setSubject, 'from')} />
            </Field>
            <Field label="Au">
              <input {...inputs(subject, setSubject, 'to')} />
            </Field>
          </div>
          <ExportButtons
            report={async () => {
              const stats = await fetchStats({ classId, year, ...subject })
              return subjectReport({ stats, subject: boot.subjects.find((s) => s.id === subject.subjectId), filters: subject })
            }}
          />
        </Panel>
        <Panel title="Rapport général de la classe">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Field label="Du">
              <input {...inputs(general, setGeneral, 'from')} />
            </Field>
            <Field label="Au">
              <input {...inputs(general, setGeneral, 'to')} />
            </Field>
          </div>
          <ExportButtons report={async () => classReport({ stats: await fetchStats({ classId, year, ...general }), filters: general })} />
        </Panel>
      </div>
    </div>
  )
}

export default Reports
