import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { deleteSession, fetchSessions } from '../../firebase/campus.js'
import { SESSION_STATUS, hours, mediumDate, searchKey } from '../../lib/campus.js'
import { fieldClass, useCampus } from './campusContext.js'
import SessionForm from './SessionForm.jsx'
import { EvaluationTag } from './slotUi.jsx'
import { ReasonDialog } from './adminUi.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { Btn, CountsLine, Empty, ErrorNote, Field, Loading, SearchBox, SessionPill } from './campusUi.jsx'

const PAGE = 20

// Every session of the class: the archive, with its filters.
function SessionsList() {
  const { boot, cls, classId, year } = useCampus()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState({ from: '', to: '', subjectId: '', teacherId: '', status: params.get('statut') || '' })
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState(null)
  const { showToast } = useToast()
  const creating = params.get('nouvelle') === '1' && boot.me.staff && cls

  const load = useCallback(() => {
    if (!classId) return undefined
    let live = true
    setError('')
    fetchSessions({ classId, year })
      .then((d) => live && setSessions(d.sessions))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [classId, year])
  useEffect(() => load(), [load])

  const found = useMemo(() => {
    const words = searchKey(search).split(' ').filter(Boolean)
    return (sessions || []).filter(
      (s) =>
        (!filters.from || s.date >= filters.from) &&
        (!filters.to || s.date <= filters.to) &&
        (!filters.subjectId || s.subjectId === filters.subjectId) &&
        (!filters.teacherId || s.teacherId === filters.teacherId) &&
        (filters.status ? s.status === filters.status : true) &&
        words.every((w) => searchKey(`${s.subjectName} ${s.teacherName} ${s.classCode} ${mediumDate(s.date)} ${s.agentName}`).includes(w)),
    )
  }, [sessions, filters, search])

  const set = (k) => (e) => {
    setPage(0)
    setFilters((f) => ({ ...f, [k]: e.target.value }))
  }
  if (!cls) return <Empty>Aucune classe pour l’instant.</Empty>
  const pages = Math.max(1, Math.ceil(found.length / PAGE))
  const at = Math.min(page, pages - 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">Séances de cours</h1>
        {boot.me.staff && (
          <Btn variant="primary" icon={Plus} onClick={() => setParams({ nouvelle: '1' })}>
            Nouvelle séance
          </Btn>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-ink/8 bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Field label="Enseignant">
          <select className={fieldClass} value={filters.teacherId} onChange={set('teacherId')}>
            <option value="">Tous</option>
            {boot.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="État de la feuille">
          <select className={fieldClass} value={filters.status} onChange={set('status')}>
            <option value="">Tous</option>
            {Object.entries(SESSION_STATUS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Du">
          <input type="date" className={fieldClass} value={filters.from} onChange={set('from')} />
        </Field>
        <Field label="Au">
          <input type="date" className={fieldClass} value={filters.to} onChange={set('to')} />
        </Field>
        <div className="flex items-end">
          <SearchBox
            value={search}
            onChange={(v) => {
              setPage(0)
              setSearch(v)
            }}
            placeholder="Matière, enseignant, agent"
            className="w-full"
          />
        </div>
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!sessions && !error && <Loading />}
      {sessions && (
        <>
          <p className="text-sm text-ink-soft">
            {found.length} séance{found.length > 1 ? 's' : ''}
          </p>
          {found.length ? (
            <ul className="space-y-2">
              {found.slice(at * PAGE, (at + 1) * PAGE).map((s) => (
                <li key={s.id} className="flex items-center gap-1">
                  <Link to={`/campus/seances/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ink/8 bg-surface p-4 transition hover:border-violet-400">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{s.subjectName}</span>
                        {s.kind === 'evaluation' && <EvaluationTag />}
                        <SessionPill status={s.status} />
                        {s.corrections > 0 && <span className="text-xs text-ink-soft">{s.corrections} correction{s.corrections > 1 ? 's' : ''}</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {mediumDate(s.date)}, {hours(s)} · {s.teacherName} · {s.classCode}
                      </span>
                      <CountsLine counts={s.counts} justified={s.justified} className="mt-1.5" />
                      <span className="mt-1 block text-xs text-ink-soft">Saisie : {s.agentName}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-soft" />
                  </Link>
                  {boot.me.admin && (
                    <button type="button" aria-label={`Supprimer ${s.subjectName} du ${mediumDate(s.date)}`} onClick={() => setDeleting(s)} className="shrink-0 rounded-xl p-3 text-ink-soft hover:bg-coral-500/10 hover:text-coral-500">
                      <Trash2 size={17} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune séance ne correspond.</Empty>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Btn icon={ChevronLeft} disabled={at === 0} onClick={() => setPage(at - 1)} aria-label="Page précédente" />
              Page {at + 1} sur {pages}
              <Btn icon={ChevronRight} disabled={at >= pages - 1} onClick={() => setPage(at + 1)} aria-label="Page suivante" />
            </div>
          )}
        </>
      )}
      {deleting && (
        <ReasonDialog
          title="Supprimer cette feuille ?"
          text={`${deleting.subjectName}, ${mediumDate(deleting.date)}, ${hours(deleting)}. Elle va dans la corbeille, d’où vous pourrez la restaurer.`}
          confirm="Supprimer"
          typed={deleting.status === 'validated'}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await deleteSession(deleting.id, reason)
            setDeleting(null)
            showToast('Feuille mise à la corbeille.', 'success')
            load()
          }}
        />
      )}
      {creating && <SessionForm onClose={() => setParams({})} />}
    </div>
  )
}

export default SessionsList
