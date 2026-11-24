import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { fetchStudent, updateStudent } from '../../firebase/campus.js'
import { STATUS, UNSET, hours, mediumDate, percent } from '../../lib/campus.js'
import { studentReport } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { EvaluationTag } from './slotUi.jsx'
import { Btn, Dialog, Empty, ErrorNote, ExportButtons, Field, Loading, Panel, StatusPill, Tile } from './campusUi.jsx'

function EditDialog({ student, onClose, onSaved }) {
  const { showToast } = useToast()
  const [name, setName] = useState(student.name)
  const [active, setActive] = useState(student.active)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateStudent(student.id, { name: name.trim(), active, reason: reason.trim() })
      showToast('Étudiant modifié.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Modifier l’étudiant"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-student" busy={busy} disabled={reason.trim().length < 3 || (name.trim() === student.name && active === student.active)}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form id="campus-student" onSubmit={submit} className="space-y-3">
        <Field label="NOM et prénom" hint="L’identifiant technique et tout l’historique sont conservés.">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Sur la liste officielle (décocher pour archiver)
        </label>
        <Field label="Motif (obligatoire)">
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} />
        </Field>
      </form>
    </Dialog>
  )
}

// One student: identity, figures, history with filters.
function StudentSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { boot, year, reload: reloadCampus } = useCampus()
  const [filters, setFilters] = useState({ from: '', to: '', subjectId: '' })
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(() => {
    let live = true
    setError('')
    fetchStudent(id, { year, ...filters })
      .then((p) => live && setPage(p))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [id, year, filters])
  useEffect(() => load(), [load])

  const history = useMemo(() => (page?.record.history || []).filter((h) => !status || (h.status ?? 'N') === status), [page, status])
  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>
  if (!page || page.student.id !== id) return <Loading />
  const { student, record } = page
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate('/campus/etudiants')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Étudiants
      </button>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{student.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {page.org} · Classe {page.className} ({page.classLabel}) · Identifiant <span className="font-mono text-ink">{student.id}</span>
            </p>
            {!student.active && <p className="mt-1 text-sm font-medium text-coral-500">N’est plus sur la liste officielle. Son historique est conservé.</p>}
            {student.nameHistory.length > 0 && <p className="mt-1 text-xs text-ink-soft">Ancienne orthographe : {student.nameHistory.map((h) => h.name).join(', ')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons report={() => studentReport({ page, history, filters: { ...filters, year } })} />
            {boot.me.admin && (
              <Btn icon={Pencil} onClick={() => setEditing(true)}>
                Modifier
              </Btn>
            )}
          </div>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Séances enregistrées" value={record.sessions} />
        <Tile label="Présences" status="P" value={record.p} />
        <Tile label="Retards" status="R" value={record.r} />
        <Tile label="Absences" status="A" value={record.a} />
        <Tile label="Non renseignés" status="N" value={record.n} />
        <Tile label="Taux de présence" value={percent(record.presenceRate)} />
      </div>
      <Panel title="Historique des séances">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Du">
            <input type="date" className={fieldClass} value={filters.from} onChange={set('from')} />
          </Field>
          <Field label="Au">
            <input type="date" className={fieldClass} value={filters.to} onChange={set('to')} />
          </Field>
          <Field label="Matière">
            <select className={fieldClass} value={filters.subjectId} onChange={set('subjectId')}>
              <option value="">Toutes</option>
              {boot.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous</option>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
              <option value="N">{UNSET}</option>
            </select>
          </Field>
        </div>
        {history.length ? (
          <ul className="divide-y divide-ink/8">
            {history.map((h) => (
              <li key={h.sessionId}>
                <Link to={`/campus/seances/${h.sessionId}`} className="flex flex-wrap items-center justify-between gap-2 py-3 transition hover:bg-ink/[0.02]">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {h.subjectName} {h.kind === 'evaluation' && <EvaluationTag />}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {mediumDate(h.date)}, {hours(h)} · {h.teacherName}
                    </span>
                    {h.note && <span className="block text-xs text-ink">Motif : {h.note}</span>}
                  </span>
                  <StatusPill status={h.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune séance validée ne correspond.</Empty>
        )}
      </Panel>
      {editing && (
        <EditDialog
          student={student}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
            reloadCampus().catch(() => {})
          }}
        />
      )}
    </div>
  )
}

export default StudentSheet
