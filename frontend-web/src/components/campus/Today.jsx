import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FilePlus2, FileWarning } from 'lucide-react'
import { fetchAgenda, fetchBlankSheets, openDay } from '../../firebase/campus.js'
import { hours, longDate, mediumDate } from '../../lib/campus.js'
import { blankBundle } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useCampus } from './campusContext.js'
import { EvaluationTag, OpenSlotButton, SlotState } from './slotUi.jsx'
import { Btn, ExportButtons, Panel } from './campusUi.jsx'

function Course({ slot, withDate }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-ink">{hours(slot)}</span>
      <span className="min-w-44 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          <span className={slot.state === 'cancelled' ? 'line-through opacity-60' : ''}>{slot.subjectName}</span>
          {slot.kind === 'evaluation' && <EvaluationTag />}
          <SlotState state={slot.state} />
        </span>
        <span className="block text-xs text-ink-soft">
          {withDate && `${mediumDate(slot.date)} · `}
          {slot.teacherName || 'Enseignant à préciser'}
          {slot.cancelled && ` · ${slot.cancelled.reason}`}
        </span>
      </span>
      <OpenSlotButton slot={slot} />
    </li>
  )
}

// What to do now, from the timetable: today's courses and their sheets, the
// sheets that are still missing, how the week is going.
function Today() {
  const { boot, cls, classId } = useCampus()
  const { showToast } = useToast()
  const [agenda, setAgenda] = useState(null)
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)

  const load = useCallback(() => {
    fetchAgenda({ classId })
      .then(setAgenda)
      .catch(() => setAgenda(null))
  }, [classId])
  useEffect(() => {
    load()
    // Courses begin and end while the page stays open.
    const timer = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [load])

  if (!agenda) return null
  const { today, missing, week, next, weekStatus, now } = agenda
  const toPrepare = today.filter((s) => !s.sessionId && s.state !== 'cancelled')

  async function prepare() {
    setBusy(true)
    try {
      const r = await openDay({ classId, date: now.date })
      const left = r.skipped.map((s) => `${s.subjectName} : ${s.message}`).join(' ')
      showToast(left || `${r.created} feuille${r.created > 1 ? 's' : ''} prête${r.created > 1 ? 's' : ''}.`, left ? 'info' : 'success')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!weekStatus && !missing.length) {
    if (!boot.me.staff) return null
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/8 bg-surface px-4 py-3 text-sm">
        <span className="text-ink-soft">Aucun planning pour cette semaine. Avec un planning, les feuilles du jour se préparent toutes seules.</span>
        <Link to="/campus/planning" className="inline-flex items-center gap-1.5 font-semibold text-violet-600">
          <CalendarDays size={16} /> Faire le planning
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Panel
        title={<span className="inline-block first-letter:uppercase">{longDate(now.date)}</span>}
        action={
          <span className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
            {week.total > 0 && (
              <span>
                Cette semaine : <b className="text-ink">{week.validated}</b> / {week.total} feuilles validées
              </span>
            )}
            <Link to="/campus/planning" className="inline-flex items-center gap-1 font-semibold text-violet-600">
              <CalendarDays size={14} /> Planning
            </Link>
          </span>
        }
      >
        {weekStatus === 'draft' && (
          <p className="mb-2 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-ink">
            Le planning de cette semaine attend d’être vérifié et publié.{' '}
            <Link to="/campus/planning" className="font-semibold text-violet-600 underline">
              Le vérifier
            </Link>
          </p>
        )}
        {today.length ? (
          <ul className="divide-y divide-ink/8">
            {today.map((s) => (
              <Course key={s.id} slot={s} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            Aucun cours aujourd’hui{next ? `. Prochain jour de cours : ${longDate(next.date)} (${next.slots.length} cours).` : '.'}
          </p>
        )}
        {boot.me.staff && today.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/8 pt-3">
            {toPrepare.length > 1 && (
              <Btn icon={FilePlus2} busy={busy} onClick={prepare}>
                Préparer les {toPrepare.length} feuilles
              </Btn>
            )}
            <ExportButtons label="Feuilles vierges du jour " excel={false} report={async () => blankBundle({ data: await fetchBlankSheets({ classId, week: today[0].week, date: now.date }), name: `${cls.code} ${now.date}` })} />
          </div>
        )}
      </Panel>
      {missing.length > 0 && boot.me.staff && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <FileWarning size={18} className="text-coral-500" /> {missing.length} feuille{missing.length > 1 ? 's' : ''} à terminer
            </span>
          }
        >
          <ul className="divide-y divide-ink/8">
            {(all ? missing : missing.slice(0, 4)).map((s) => (
              <Course key={`${s.week}-${s.id}`} slot={s} withDate />
            ))}
          </ul>
          {missing.length > 4 && (
            <Btn variant="ghost" className="mt-2 w-full" onClick={() => setAll((v) => !v)}>
              {all ? 'Réduire' : `Voir les ${missing.length}`}
            </Btn>
          )}
          <p className="mt-2 text-xs text-ink-soft">Cours passés, sans feuille validée. Un cours qui n’a pas eu lieu se marque « annulé » dans le planning.</p>
        </Panel>
      )}
    </div>
  )
}

export default Today
