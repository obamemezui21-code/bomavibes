import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { addStudent, fetchStats, fetchStudents } from '../../firebase/campus.js'
import { matchesSearch } from '../../lib/campus.js'
import { officialListReport } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { Btn, Dialog, Empty, ErrorNote, ExportButtons, Field, Loading, RateBar, SearchBox } from './campusUi.jsx'

function AddDialog({ cls, onClose, onAdded }) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [same, setSame] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await addStudent(cls.id, { name: name.trim(), force: !!same })
      showToast('Étudiant ajouté.', 'success')
      onAdded()
    } catch (err) {
      if (err.code === 'SAME_NAME') setSame(err.message)
      else showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Ajouter un étudiant"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-add" busy={busy}>
            {same ? 'Ajouter quand même' : 'Ajouter'}
          </Btn>
        </>
      }
    >
      <form id="campus-add" onSubmit={submit} className="space-y-3">
        <Field label="NOM et prénom" hint={`L’effectif de la classe ${cls.code} passe à un étudiant de plus. Il apparaîtra dans les séances créées ensuite.`}>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSame('')
            }}
            required
            minLength={2}
            maxLength={120}
          />
        </Field>
        {same && <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-ink">{same} Ajoutez-le seulement si c’est une autre personne.</p>}
      </form>
    </Dialog>
  )
}

// The official list, with each student's own rate for the year.
function Students() {
  const { boot, cls, classId, year, reload } = useCampus()
  const [students, setStudents] = useState(null)
  const [rates, setRates] = useState(new Map())
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    if (!classId) return undefined
    let live = true
    setError('')
    fetchStudents(classId)
      .then((s) => live && setStudents(s))
      .catch((err) => live && setError(err.message))
    fetchStats({ classId, year })
      .then((s) => live && setRates(new Map(s.students.map((x) => [x.id, x]))))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [classId, year])
  useEffect(() => load(), [load])

  const active = useMemo(() => (students || []).filter((s) => s.active), [students])
  const gone = useMemo(() => (students || []).filter((s) => !s.active), [students])
  const list = (archived ? gone : active).filter((s) => matchesSearch(search, s))

  if (!cls) return <Empty>Aucune classe pour l’instant.</Empty>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Étudiants · {cls.code}</h1>
          {students && (
            <p className="text-sm text-ink-soft">
              {active.length} étudiant{active.length > 1 ? 's' : ''} sur la liste officielle
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {active.length > 0 && boot.me.staff && <ExportButtons report={() => officialListReport({ cls: { ...cls, org: boot.org }, students: active, today: boot.today })} />}
          {boot.me.admin && (
            <Btn icon={UserPlus} onClick={() => setAdding(true)}>
              Ajouter
            </Btn>
          )}
        </div>
      </div>
      <SearchBox value={search} onChange={setSearch} />
      {gone.length > 0 && (
        <div className="flex gap-1.5">
          {[
            [false, `Liste officielle ${active.length}`],
            [true, `Archivés ${gone.length}`],
          ].map(([value, label]) => (
            <button key={label} type="button" aria-pressed={archived === value} onClick={() => setArchived(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${archived === value ? 'border-violet-950 bg-violet-950 text-white dark:border-violet-600 dark:bg-violet-600' : 'border-ink/12 bg-surface text-ink-soft'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!students && !error && <Loading />}
      {students &&
        (list.length ? (
          <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/8 bg-surface">
            {list.map((s) => {
              const r = rates.get(s.id)
              return (
                <li key={s.id}>
                  <Link to={`/campus/etudiants/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-ink/[0.03]">
                    <span className="w-8 text-right text-xs tabular-nums text-ink-soft">{s.no}</span>
                    <span className="min-w-40 flex-1 text-sm font-medium text-ink">{s.name}</span>
                    <span className="hidden font-mono text-xs text-ink-soft md:block">{s.id}</span>
                    <span className="hidden w-36 text-xs text-ink-soft lg:block">{r ? `${r.a} abs. · ${r.r} ret.` : ''}</span>
                    <span className="w-full pl-12 sm:w-40 sm:pl-0">{r?.rated ? <RateBar rate={r.presenceRate} /> : <span className="text-xs text-ink-soft">Aucune séance validée</span>}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>{search ? 'Aucun étudiant trouvé.' : 'La liste officielle n’est pas encore importée.'}</Empty>
        ))}
      {adding && (
        <AddDialog
          cls={cls}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            load()
            reload().catch(() => {})
          }}
        />
      )}
    </div>
  )
}

export default Students
