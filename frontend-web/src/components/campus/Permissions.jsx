import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { fetchPermissions, fetchStudents } from '../../firebase/campus.js'
import { matchesSearch } from '../../lib/campus.js'
import { permissionsReport } from '../../lib/campusReports.js'
import { useCampus } from './campusContext.js'
import { PermissionDialog, PermissionItem } from './permissionUi.jsx'
import { Btn, Empty, ErrorNote, ExportButtons, Loading, Panel, SearchBox } from './campusUi.jsx'

const VIEWS = [
  ['today', 'Aujourd’hui'],
  ['coming', 'À venir'],
  ['all', 'Toutes'],
]

// Who may leave or be away, and why: granted by the person in charge of
// studies. The sheets follow by themselves.
function Permissions() {
  const { boot, cls, classId } = useCampus()
  const [list, setList] = useState(null)
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState('today')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    if (!classId) return undefined
    let live = true
    setError('')
    fetchPermissions({ classId })
      .then((p) => live && setList(p))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [classId])
  useEffect(() => load(), [load])
  useEffect(() => {
    if (!classId || !boot.me.canPermit) return
    fetchStudents(classId)
      .then(setStudents)
      .catch(() => {})
  }, [classId, boot.me.canPermit])

  const today = boot.today
  const shown = useMemo(
    () =>
      (list || []).filter((p) => {
        if (view === 'today' && !(p.status === 'active' && p.start <= `${today}T23:59` && p.end >= `${today}T00:00`)) return false
        if (view === 'coming' && !(p.status === 'active' && p.start > `${today}T23:59`)) return false
        return matchesSearch(search, { name: p.studentName })
      }),
    [list, view, search, today],
  )

  if (!boot.me.staff) return <Empty>Réservé à l’administration et aux agents pédagogiques.</Empty>
  if (!cls) return <Empty>Aucune classe pour l’instant.</Empty>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Permissions · {cls.code}</h1>
          <p className="text-sm text-ink-soft">Sorties et absences autorisées. Une absence couverte en entier par une permission est justifiée d’office.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shown.length > 0 && <ExportButtons report={() => permissionsReport({ org: boot.org, cls, permissions: shown, title: VIEWS.find(([k]) => k === view)[1], today })} />}
          {boot.me.canPermit && (
            <Btn variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              Nouvelle permission
            </Btn>
          )}
        </div>
      </div>
      {!boot.me.canPermit && <p className="rounded-2xl border border-ink/8 bg-surface px-4 py-3 text-sm text-ink-soft">Vous consultez les permissions. Elles sont accordées par la chargée pédagogique ou l’administrateur.</p>}
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${view === key ? 'border-violet-950 bg-violet-950 text-white dark:border-violet-600 dark:bg-violet-600' : 'border-ink/12 bg-surface text-ink-soft'}`}>
            {label}
          </button>
        ))}
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un étudiant" />
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!list && !error && <Loading />}
      {list && (
        <Panel>
          {shown.length ? (
            <ul className="divide-y divide-ink/8">
              {shown.map((p) => (
                <PermissionItem key={p.id} permission={p} showName onChanged={load} />
              ))}
            </ul>
          ) : (
            <Empty>{search ? 'Aucune permission trouvée.' : view === 'today' ? 'Aucune permission aujourd’hui.' : 'Aucune permission.'}</Empty>
          )}
        </Panel>
      )}
      {adding && (
        <PermissionDialog
          students={students}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            load()
          }}
        />
      )}
    </div>
  )
}

export default Permissions
