import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Upload } from 'lucide-react'
import { createClass, fetchStats } from '../../firebase/campus.js'
import { dayMonth, hours, matchesSearch, mediumDate, monthLabel, monthShort, percent, shortDate } from '../../lib/campus.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { Columns, RateBars } from './Charts.jsx'
import Today from './Today.jsx'
import { Btn, CountsLine, Empty, ErrorNote, Field, Loading, Panel, SearchBox, SessionPill, Tile } from './campusUi.jsx'

// First use: the class doesn't exist yet.
function FirstClass() {
  const { boot, reload } = useCampus()
  const { showToast } = useToast()
  const [form, setForm] = useState({ code: 'L1', label: 'Licence 1', expected: '119' })
  const [busy, setBusy] = useState(false)
  if (!boot.me.admin) return <Empty>Aucune classe pour l’instant. L’administrateur doit créer la classe et importer la liste officielle.</Empty>

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await createClass({ code: form.code, label: form.label, expected: Number(form.expected) })
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Panel title="Créer la première classe" className="mx-auto max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Classe">
          <input className={fieldClass} value={form.code} onChange={set('code')} required maxLength={20} />
        </Field>
        <Field label="Intitulé">
          <input className={fieldClass} value={form.label} onChange={set('label')} required maxLength={60} />
        </Field>
        <Field label="Effectif officiel" hint="Vérifié à l’importation de la liste.">
          <input className={fieldClass} type="number" min="1" max="400" value={form.expected} onChange={set('expected')} required />
        </Field>
        <Btn variant="primary" type="submit" busy={busy} className="w-full">
          Créer la classe
        </Btn>
      </form>
    </Panel>
  )
}

function Dashboard() {
  const { boot, cls, classId, year } = useCampus()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ from: '', to: '', subjectId: '' })
  const [scope, setScope] = useState('last')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(() => {
    if (!classId) return undefined
    let live = true
    setError('')
    fetchStats({ classId, year, ...filters })
      .then((s) => live && setStats(s))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [classId, year, filters])
  useEffect(() => load(), [load])

  const students = useMemo(() => {
    const list = (stats?.students || []).filter((s) => s.rated && matchesSearch(search, s))
    return [...list].sort((a, b) => a.presenceRate - b.presenceRate || a.name.localeCompare(b.name, 'fr'))
  }, [stats, search])

  if (!cls) return <FirstClass />
  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>
  if (!stats) return <Loading />

  if (!stats.class.active) {
    return (
      <Panel title="Liste officielle à importer" className="mx-auto max-w-lg">
        <p className="text-sm text-ink-soft">La classe {cls.code} n’a pas encore d’étudiants.</p>
        {boot.me.admin ? (
          <Link to="/campus/administration" className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-950 px-3.5 py-2 text-sm font-semibold text-white dark:bg-violet-600">
            <Upload size={16} /> Importer la liste
          </Link>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">L’administrateur doit d’abord importer la liste officielle.</p>
        )}
      </Panel>
    )
  }

  const last = stats.last
  const onLast = scope === 'last' && last
  const c = onLast ? last.counts : stats.totals
  const justified = onLast ? last.justified : c.j
  const rated = c.p + c.r + c.a
  // A chosen period or subject is about the whole, not the last session.
  const set = (k) => (e) => {
    setScope('all')
    setFilters((f) => ({ ...f, [k]: e.target.value }))
  }
  const shown = showAll || search ? students : students.slice(0, 8)

  return (
    <div className="space-y-4">
      <Today key={classId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-ink/12 bg-surface p-1 text-sm font-semibold" role="group" aria-label="Chiffres affichés">
          {[
            ['last', 'Dernière séance'],
            ['all', 'Toute la période'],
          ].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)} className={`rounded-lg px-3 py-1.5 transition ${scope === key ? 'bg-violet-950 text-white dark:bg-violet-600' : 'text-ink-soft hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {boot.me.staff && (
          <Btn variant="primary" icon={Plus} onClick={() => navigate('/campus/seances?nouvelle=1')}>
            Nouvelle séance
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ink/8 bg-surface p-4 sm:grid-cols-3">
        <Field label="Du">
          <input type="date" className={fieldClass} value={filters.from} max={filters.to || undefined} onChange={set('from')} />
        </Field>
        <Field label="Au">
          <input type="date" className={fieldClass} value={filters.to} min={filters.from || undefined} onChange={set('to')} />
        </Field>
        <div className="col-span-2 sm:col-span-1">
          <Field label="Matière">
            <select className={fieldClass} value={filters.subjectId} onChange={set('subjectId')}>
              <option value="">Toutes les matières</option>
              {boot.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <p className="text-sm text-ink-soft">
        {onLast ? (
          <>
            {last.subjectName}, {last.teacherName} · {mediumDate(last.date)}, {hours(last)} ·{' '}
            <Link className="font-semibold text-violet-600 underline" to={`/campus/seances/${last.id}`}>
              ouvrir la feuille
            </Link>
          </>
        ) : scope === 'last' ? (
          'Aucune séance validée pour l’instant.'
        ) : (
          `${stats.sessions} séance${stats.sessions > 1 ? 's' : ''} validée${stats.sessions > 1 ? 's' : ''}`
        )}
        {stats.drafts > 0 && (
          <>
            {' '}
            ·{' '}
            <Link className="font-semibold text-violet-600 underline" to="/campus/seances?statut=draft">
              {stats.drafts} feuille{stats.drafts > 1 ? 's' : ''} en cours de saisie
            </Link>
          </>
        )}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Effectif total" value={stats.class.active} hint={stats.class.active === cls.expected ? 'conforme à la liste officielle' : `liste officielle : ${cls.expected}`} />
        <Tile label="Présents" status="P" value={c.p} />
        <Tile label="Retardataires" status="R" value={c.r} />
        <Tile label="Absents" status="A" value={c.a} hint={c.a ? `${justified} justifié${justified > 1 ? 's' : ''}, ${c.a - justified} non justifié${c.a - justified > 1 ? 's' : ''}` : ''} />
        <Tile label="Non renseignés" status="N" value={c.n} />
        <Tile label="Taux de présence" value={percent(rated ? (c.p + c.r) / rated : null)} hint="présents et retards" />
        <Tile label="Taux d’absence" value={percent(rated ? c.a / rated : null)} hint={rated ? `non justifiées : ${percent((c.a - justified) / rated)}` : ''} />
        <Tile label="Séances validées" value={stats.sessions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title="Absences par semaine">
          <Columns
            unit="absences"
            head={['Semaine', 'Absences', 'Détail']}
            data={stats.weeks.map((w) => ({ key: w.week, label: dayMonth(w.week), long: `Semaine du ${shortDate(w.week)}`, value: w.a, extra: `${w.j} justifiées, ${w.a - w.j} non justifiées · ${w.sessions} séance${w.sessions > 1 ? 's' : ''}` }))}
          />
        </Panel>
        <Panel title="Retards par mois">
          <Columns
            unit="retards"
            head={['Mois', 'Retards', 'Séances']}
            data={stats.months.map((m) => ({ key: m.month, label: monthShort(m.month), long: monthLabel(m.month), value: m.r, extra: `${m.sessions} séance${m.sessions > 1 ? 's' : ''}` }))}
          />
        </Panel>
        <Panel title="Taux de présence par matière">
          <RateBars head={['Matière', 'Présence', 'Détail']} data={stats.subjects.map((s) => ({ key: s.id, label: s.name, rate: s.presenceRate, extra: `${s.sessions} séance${s.sessions > 1 ? 's' : ''}, ${s.a} absences, ${s.r} retards` }))} />
        </Panel>
        <Panel title="Taux de présence par étudiant" action={<span className="text-xs text-ink-soft">du plus faible au plus élevé</span>}>
          <SearchBox value={search} onChange={setSearch} className="mb-3" />
          <RateBars
            head={['Étudiant', 'Présence', 'Détail']}
            empty={search ? 'Aucun étudiant trouvé.' : undefined}
            data={shown.map((s) => ({ key: s.id, label: s.name, rate: s.presenceRate, extra: `${s.sessions} séances, ${s.a} absences (${s.j} justifiées), ${s.r} retards`, onClick: () => navigate(`/campus/etudiants/${s.id}`) }))}
          />
          {!search && students.length > 8 && (
            <Btn variant="ghost" className="mt-2 w-full" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Réduire' : `Voir les ${students.length} étudiants`}
            </Btn>
          )}
        </Panel>
      </div>

      <Panel
        title="Dernières séances"
        action={
          <Link to="/campus/seances" className="text-sm font-semibold text-violet-600">
            Tout l’historique
          </Link>
        }
      >
        {stats.recent.length ? (
          <ul className="divide-y divide-ink/8">
            {stats.recent.map((s) => (
              <li key={s.id}>
                <Link to={`/campus/seances/${s.id}`} className="flex items-center gap-3 py-3 transition hover:bg-ink/[0.02]">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {s.subjectName} <SessionPill status={s.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {mediumDate(s.date)}, {hours(s)} · {s.teacherName}
                    </span>
                    <CountsLine counts={s.counts} justified={s.justified} className="mt-1" />
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-soft" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune séance cette année.</Empty>
        )}
      </Panel>
      <p className="text-xs text-ink-soft">Taux calculés sur les séances validées et les statuts renseignés uniquement. Un étudiant en retard est compté comme présent dans le taux de présence.</p>
    </div>
  )
}

export default Dashboard
