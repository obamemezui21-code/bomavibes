import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, ChevronLeft, ChevronRight, Copy, Pencil, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { addNamed, cancelSlot, copyTimetable, fetchBlankSheets, fetchTimetable, publishTimetable, saveTimetable } from '../../firebase/campus.js'
import { DAYS, addDays, dayMonth, hours, mondayOf, searchKey, shortDate } from '../../lib/campus.js'
import { blankBundle, timetableReport } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { EvaluationTag, OpenSlotButton, SlotState } from './slotUi.jsx'
import { Btn, Dialog, Empty, ErrorNote, ExportButtons, Field, Loading, Panel } from './campusUi.jsx'

const cellOf = (slots, day, periodId) => slots.find((s) => s.day === day && s.periodId === periodId)

// One cell while editing: the subject, the teacher, course or evaluation.
function CellDialog({ cell, onClose, onSave, onClear }) {
  const { boot } = useCampus()
  const { showToast } = useToast()
  const [subject, setSubject] = useState(cell.slot?.subjectName || '')
  const [teacher, setTeacher] = useState(cell.slot?.teacherName || '')
  const [evaluation, setEvaluation] = useState(cell.slot?.kind === 'evaluation')
  const [busy, setBusy] = useState(false)

  async function named(kind, list, name) {
    const found = list.find((x) => searchKey(x.name) === searchKey(name))
    return found || addNamed(kind, name.trim())
  }
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const s = await named('subjects', boot.subjects, subject)
      const t = teacher.trim() ? await named('teachers', boot.teachers, teacher) : null
      onSave({ day: cell.day, periodId: cell.period.id, subjectId: s.id, subjectName: s.name, teacherId: t?.id || null, teacherName: t?.name || null, kind: evaluation ? 'evaluation' : 'course' })
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={`${DAYS[cell.day - 1]}, ${cell.period.label}`}
      onClose={onClose}
      footer={
        <>
          {cell.slot && (
            <Btn variant="ghost" icon={Trash2} onClick={onClear} className="mr-auto">
              Vider
            </Btn>
          )}
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-cell" busy={busy}>
            Placer ce cours
          </Btn>
        </>
      }
    >
      <form id="campus-cell" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-soft">{hours(cell.period)}</p>
        <Field label="Matière">
          <input className={fieldClass} list="campus-cell-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={2} maxLength={100} autoComplete="off" />
          <datalist id="campus-cell-subjects">
            {boot.subjects
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.name} />
              ))}
          </datalist>
        </Field>
        <Field label="Enseignant" hint="Facultatif : s’il manque, il est demandé à l’ouverture de la feuille.">
          <input className={fieldClass} list="campus-cell-teachers" value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={100} autoComplete="off" />
          <datalist id="campus-cell-teachers">
            {boot.teachers
              .filter((t) => t.active)
              .map((t) => (
                <option key={t.id} value={t.name} />
              ))}
          </datalist>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={evaluation} onChange={(e) => setEvaluation(e.target.checked)} />
          C’est une évaluation
        </label>
      </form>
    </Dialog>
  )
}

function CancelDialog({ slot, onClose, onDone }) {
  const { classId } = useCampus()
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await cancelSlot({ classId, week: slot.week, slotId: slot.id, reason: reason.trim() })
      onDone()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Ce cours n’a pas lieu ?"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Retour</Btn>
          <Btn variant="danger" type="submit" form="campus-cancel-slot" busy={busy} disabled={reason.trim().length < 3}>
            Marquer annulé
          </Btn>
        </>
      }
    >
      <form id="campus-cancel-slot" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-soft">
          {slot.subjectName}, {shortDate(slot.date)}, {hours(slot)}. Sa feuille ne sera plus réclamée. Aucune absence n’est comptée.
        </p>
        <Field label="Motif">
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enseignant absent, jour férié…" required minLength={3} maxLength={200} />
        </Field>
      </form>
    </Dialog>
  )
}

// The whole week being written: the grid, the hours, the note.
function Editor({ week, start, onClose, onSaved }) {
  const { cls, reload } = useCampus()
  const { showToast } = useToast()
  const [periods, setPeriods] = useState(start.periods)
  const [slots, setSlots] = useState(start.slots)
  const [title, setTitle] = useState(start.title)
  const [note, setNote] = useState(start.note)
  const [saturday, setSaturday] = useState(start.slots.some((s) => s.day === 6))
  const [cell, setCell] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const days = saturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
  const sorted = [...periods].sort((a, b) => (a.start < b.start ? -1 : 1))

  const setPeriod = (id, k) => (e) => setPeriods((list) => list.map((p) => (p.id === id ? { ...p, [k]: e.target.value } : p)))
  function addPeriod() {
    const n = Math.max(0, ...periods.map((p) => Number(p.id.slice(1)))) + 1
    const last = sorted.at(-1)
    setPeriods([...periods, { id: `p${n}`, label: `${periods.length + 1}ème période`, start: last ? last.end : '08:00', end: last && last.end < '22:00' ? `${String(Number(last.end.slice(0, 2)) + 2).padStart(2, '0')}:${last.end.slice(3)}` : '23:00' }])
  }
  function removePeriod(id) {
    setPeriods(periods.filter((p) => p.id !== id))
    setSlots(slots.filter((s) => s.periodId !== id))
  }
  const place = (slot) => {
    setSlots([...slots.filter((s) => !(s.day === slot.day && s.periodId === slot.periodId)), slot])
    setCell(null)
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const kept = saturday ? slots : slots.filter((s) => s.day < 6)
      await saveTimetable({ classId: cls.id, week, version: start.version, title: title.trim(), note: note.trim(), periods, slots: kept.map(({ day, periodId, subjectId, teacherId, kind }) => ({ day, periodId, subjectId, teacherId: teacherId || null, kind })) })
      showToast('Planning enregistré.', 'success')
      reload().catch(() => {})
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Panel title={`Planning de la semaine du ${shortDate(week)}`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Intitulé">
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Classe ou promotion concernée" />
        </Field>
        <label className="flex items-end gap-2 pb-3 text-sm text-ink">
          <input type="checkbox" className="mb-0.5 h-4 w-4 accent-violet-600" checked={saturday} onChange={(e) => setSaturday(e.target.checked)} />
          Cours le samedi
        </label>
      </div>
      <p className="mb-2 text-sm text-ink-soft">Touchez une case pour y placer un cours.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-44 text-left text-xs font-semibold text-ink-soft">Période</th>
              {days.map((d) => (
                <th key={d} className="px-1 pb-1 text-left text-xs font-semibold text-ink-soft">
                  {DAYS[d - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td className="align-top">
                  <div className="space-y-1">
                    <input aria-label="Nom de la période" className="h-9 w-full rounded-lg border border-ink/12 bg-surface px-2 text-xs font-semibold text-ink" value={p.label} maxLength={40} onChange={setPeriod(p.id, 'label')} />
                    <div className="flex items-center gap-1">
                      <input aria-label={`Début, ${p.label}`} type="time" className="h-9 min-w-0 flex-1 rounded-lg border border-ink/12 bg-surface px-1 text-xs text-ink" value={p.start} onChange={setPeriod(p.id, 'start')} />
                      <input aria-label={`Fin, ${p.label}`} type="time" className="h-9 min-w-0 flex-1 rounded-lg border border-ink/12 bg-surface px-1 text-xs text-ink" value={p.end} onChange={setPeriod(p.id, 'end')} />
                      {periods.length > 1 && (
                        <button type="button" aria-label={`Supprimer ${p.label}`} onClick={() => removePeriod(p.id)} className="rounded-lg p-1.5 text-ink-soft hover:bg-coral-500/10 hover:text-coral-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                {days.map((d) => {
                  const s = cellOf(slots, d, p.id)
                  return (
                    <td key={d} className="h-20 align-top">
                      <button type="button" aria-label={`${DAYS[d - 1]}, ${p.label}${s ? ` : ${s.subjectName}` : ' : vide'}`} onClick={() => setCell({ day: d, period: p, slot: s })} className={`flex h-full min-h-20 w-full flex-col items-start gap-1 rounded-xl border p-2 text-left transition hover:border-violet-400 ${s ? 'border-ink/12 bg-surface' : 'items-center justify-center border-dashed border-ink/20'}`}>
                        {s ? (
                          <>
                            {s.kind === 'evaluation' && <EvaluationTag />}
                            <span className="text-xs font-semibold text-ink">{s.subjectName}</span>
                            <span className="text-xs text-ink-soft">{s.teacherName || 'Enseignant ?'}</span>
                          </>
                        ) : (
                          <Plus size={16} className="text-ink-soft" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        {periods.length < 8 && (
          <Btn variant="ghost" icon={Plus} onClick={addPeriod}>
            Ajouter une période
          </Btn>
        )}
      </div>
      <div className="mt-3">
        <Field label="Note de la direction (imprimée sous le planning)">
          <textarea className="w-full rounded-xl border border-ink/12 bg-surface p-3 text-sm text-ink outline-none focus:border-violet-400" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-ink/8 pt-4">
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" busy={busy} onClick={save}>
          Enregistrer le planning
        </Btn>
      </div>
      {cell && (
        <CellDialog
          cell={cell}
          onClose={() => setCell(null)}
          onSave={place}
          onClear={() => {
            setSlots(slots.filter((s) => s !== cell.slot))
            setCell(null)
          }}
        />
      )}
    </Panel>
  )
}

function CourseCard({ slot, staff, published, onCancel, onRestore }) {
  return (
    <div className={`flex h-full flex-col gap-1.5 rounded-xl border p-2.5 ${slot.kind === 'evaluation' ? 'border-coral-500/40' : 'border-ink/10'} ${slot.state === 'now' ? 'bg-violet-500/[0.07]' : 'bg-surface'}`}>
      <span className="flex flex-wrap gap-1">
        {slot.kind === 'evaluation' && <EvaluationTag />}
        {published && <SlotState state={slot.state} />}
      </span>
      <span className={`text-sm font-semibold text-ink ${slot.state === 'cancelled' ? 'line-through opacity-60' : ''}`}>{slot.subjectName}</span>
      <span className="text-xs text-ink-soft">
        {slot.teacherName || 'Enseignant à préciser'}
        {slot.cancelled && slot.state === 'cancelled' && <span className="block">{slot.cancelled.reason}</span>}
      </span>
      {published && (
        <span className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <OpenSlotButton slot={slot} compact className="!min-h-9 !px-3 !py-1 !text-xs" />
          {staff && !slot.sessionId && slot.state !== 'cancelled' && (
            <button type="button" aria-label={`Annuler ${slot.subjectName} du ${shortDate(slot.date)}`} title="Ce cours n’a pas lieu" onClick={() => onCancel(slot)} className="rounded-lg p-2 text-ink-soft hover:bg-ink/5">
              <Ban size={15} />
            </button>
          )}
          {staff && slot.state === 'cancelled' && (
            <button type="button" onClick={() => onRestore(slot)} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-xs font-semibold text-ink-soft hover:bg-ink/5">
              <RotateCcw size={13} /> Rétablir
            </button>
          )}
        </span>
      )}
    </div>
  )
}

// The timetable of a week, and the sheet of each course.
function Timetable() {
  const { boot, cls, classId } = useCampus()
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const thisWeek = mondayOf(boot.today)
  const asked = params.get('semaine')
  const week = asked && mondayOf(asked) === asked ? asked : thisWeek
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(() => {
    if (!classId) return undefined
    let live = true
    setError('')
    fetchTimetable({ classId, week })
      .then((d) => live && setData(d))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [classId, week])
  useEffect(() => {
    setEditing(false)
    return load()
  }, [load])

  const t = data?.week === week ? data.timetable : null
  const days = useMemo(() => (t?.slots.some((s) => s.day === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]), [t])
  if (!cls) return <Empty>Aucune classe pour l’instant.</Empty>
  const go = (w) => setParams(w === thisWeek ? {} : { semaine: w })
  const published = t?.status === 'published'
  const staff = boot.me.staff

  async function act(key, action, message) {
    setBusy(key)
    try {
      await action()
      showToast(message, 'success')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }
  const restore = (slot) => act('restore', () => cancelSlot({ classId, week, slotId: slot.id, reason: null }), 'Cours rétabli.')
  const copy = (from) => act('copy', () => copyTimetable({ classId, from, to: week }), 'Planning repris : vérifiez-le, puis publiez-le.')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">Planning des cours · {cls.code}</h1>
        <div className="flex items-center gap-1">
          <Btn icon={ChevronLeft} aria-label="Semaine précédente" onClick={() => go(addDays(week, -7))} />
          <span className="min-w-44 text-center text-sm font-semibold text-ink">
            {dayMonth(week)} – {dayMonth(addDays(week, days.length - 1))}
          </span>
          <Btn icon={ChevronRight} aria-label="Semaine suivante" onClick={() => go(addDays(week, 7))} />
          {week !== thisWeek && (
            <Btn variant="ghost" onClick={() => go(thisWeek)}>
              Cette semaine
            </Btn>
          )}
        </div>
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!error && data?.week !== week && <Loading />}

      {data?.week === week && !editing && !t && (
        <Panel>
          <p className="text-sm text-ink-soft">Aucun planning {staff ? '' : 'publié '}pour cette semaine.</p>
          {staff && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.previous && (
                <Btn variant="primary" icon={Copy} busy={busy === 'copy'} onClick={() => copy(data.previous)}>
                  Reprendre la semaine du {dayMonth(data.previous)}
                </Btn>
              )}
              <Btn icon={Plus} onClick={() => setEditing(true)}>
                Nouveau planning
              </Btn>
            </div>
          )}
        </Panel>
      )}

      {editing && (
        <Editor
          week={week}
          start={t ? { periods: t.periods, slots: t.slots.map((s) => (s.teacherId ? s : { ...s, teacherName: null })), title: t.title, note: t.note, version: t.version } : { periods: data.defaultPeriods, slots: [], title: cls.label, note: '', version: 0 }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      )}

      {t && !editing && (
        <>
          {!published && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-ink">
              <span>Brouillon : vérifiez chaque case, puis publiez. Les feuilles s’ouvriront ensuite en une touche.</span>
              <Btn variant="primary" icon={Send} busy={busy === 'publish'} onClick={() => act('publish', () => publishTimetable({ classId, week, published: true }), 'Planning publié.')}>
                Publier
              </Btn>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-soft">
              {t.title}
              {t.updatedBy && ` · mis à jour par ${t.updatedBy}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {staff && (
                <Btn icon={Pencil} onClick={() => setEditing(true)}>
                  Modifier
                </Btn>
              )}
              <ExportButtons report={() => timetableReport({ org: boot.org, cls, timetable: t })} />
              {staff && <ExportButtons label="Feuilles vierges " excel={false} print={false} report={async () => blankBundle({ data: await fetchBlankSheets({ classId, week }), name: `${cls.code} semaine ${week}` })} />}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[46rem] table-fixed border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="w-28" />
                  {days.map((d) => {
                    const date = addDays(week, d - 1)
                    return (
                      <th key={d} scope="col" className={`pb-1 text-left text-sm font-semibold ${date === boot.today ? 'text-violet-600' : 'text-ink'}`}>
                        {DAYS[d - 1]} <span className="text-xs font-normal text-ink-soft">{dayMonth(date)}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {t.periods.map((p) => (
                  <tr key={p.id} className="h-px">
                    <th scope="row" className="align-top text-left">
                      <span className="block text-xs font-semibold text-ink">{p.label}</span>
                      <span className="text-xs font-normal text-ink-soft">{hours(p)}</span>
                    </th>
                    {days.map((d) => {
                      const s = cellOf(t.slots, d, p.id)
                      return (
                        <td key={d} className="h-full align-top">
                          {s ? <CourseCard slot={s} staff={staff} published={published} onCancel={setCancelling} onRestore={restore} /> : <div className="h-full min-h-16 rounded-xl border border-dashed border-ink/10" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-4 md:hidden">
            {days.map((d) => {
              const list = t.slots.filter((s) => s.day === d)
              if (!list.length) return null
              const date = addDays(week, d - 1)
              return (
                <section key={d}>
                  <h2 className={`mb-1.5 text-sm font-semibold ${date === boot.today ? 'text-violet-600' : 'text-ink'}`}>
                    {DAYS[d - 1]} {dayMonth(date)}
                  </h2>
                  <ul className="space-y-1.5">
                    {list.map((s) => (
                      <li key={s.id} className="flex gap-2">
                        <span className="w-14 shrink-0 pt-2 text-xs font-semibold tabular-nums text-ink-soft">
                          {s.start}
                          <br />
                          {s.end}
                        </span>
                        <div className="min-w-0 flex-1">
                          <CourseCard slot={s} staff={staff} published={published} onCancel={setCancelling} onRestore={restore} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
          {t.note && <p className="whitespace-pre-line rounded-2xl border border-ink/8 bg-surface px-4 py-3 text-sm text-ink">{t.note}</p>}
          {published && staff && (
            <Btn variant="ghost" busy={busy === 'unpublish'} onClick={() => act('unpublish', () => publishTimetable({ classId, week, published: false }), 'Planning remis en brouillon.')}>
              Remettre en brouillon
            </Btn>
          )}
        </>
      )}
      {cancelling && (
        <CancelDialog
          slot={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            showToast('Cours marqué annulé.', 'success')
            load()
          }}
        />
      )}
    </div>
  )
}

export default Timetable
