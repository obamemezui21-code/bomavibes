import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleDot, ClipboardPen, Clock3, FileWarning, Ban } from 'lucide-react'
import { addNamed, openSlot } from '../../firebase/campus.js'
import { hours, searchKey } from '../../lib/campus.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { Btn, Dialog, Field } from './campusUi.jsx'

// A course of the timetable and its sheet, shared by the dashboard and the
// timetable page.

const STATES = {
  validated: { label: 'Validée', icon: CheckCircle2, className: 'bg-mint-500/15 text-mint-600 dark:text-mint-400' },
  draft: { label: 'En cours de saisie', icon: ClipboardPen, className: 'bg-amber-400/20 text-amber-800 dark:text-amber-300' },
  now: { label: 'En ce moment', icon: CircleDot, className: 'bg-violet-500/15 text-violet-600' },
  upcoming: { label: 'À venir', icon: Clock3, className: 'bg-ink/8 text-ink-soft' },
  missing: { label: 'Feuille manquante', icon: FileWarning, className: 'bg-coral-500/15 text-coral-600 dark:text-coral-400' },
  cancelled: { label: 'Cours annulé', icon: Ban, className: 'bg-ink/8 text-ink-soft' },
}

export function SlotState({ state }) {
  const s = STATES[state]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${s.className}`}>
      <Icon size={11} strokeWidth={2.75} aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function EvaluationTag() {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-coral-600 px-2 py-0.5 text-[11px] font-bold text-white">Évaluation</span>
}

// The subject's teacher isn't on the timetable (an evaluation, often): asked
// for when its sheet is opened.
function TeacherDialog({ slot, onClose, onChosen }) {
  const { boot } = useCampus()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const found = boot.teachers.find((t) => searchKey(t.name) === searchKey(name))
    try {
      await onChosen(found ? found.id : (await addNamed('teachers', name.trim())).id)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Enseignant de ce cours"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-slot-teacher" busy={busy}>
            Ouvrir la feuille
          </Btn>
        </>
      }
    >
      <form id="campus-slot-teacher" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-soft">
          Le planning ne dit pas qui assure « {slot.subjectName} » le {slot.date.split('-').reverse().join('/')} ({hours(slot)}).
        </p>
        <Field label="Enseignant">
          <input className={fieldClass} list="campus-slot-teachers" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="off" />
          <datalist id="campus-slot-teachers">
            {boot.teachers
              .filter((t) => t.active)
              .map((t) => (
                <option key={t.id} value={t.name} />
              ))}
          </datalist>
        </Field>
      </form>
    </Dialog>
  )
}

// A button that opens the sheet of a course: the one it has, or a new one with
// everything already filled in but the marks.
export function OpenSlotButton({ slot, className = '', compact }) {
  const { boot, classId, reload } = useCampus()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [overlap, setOverlap] = useState(null)

  async function open(extra = {}) {
    setBusy(true)
    try {
      const { id } = await openSlot({ classId, week: slot.week, slotId: slot.id, ...extra })
      if (extra.teacherId) reload().catch(() => {})
      navigate(`/campus/seances/${id}`)
    } catch (err) {
      if (err.code === 'TEACHER') setAsking(true)
      else if (err.code === 'OVERLAP') setOverlap({ message: err.message, extra })
      else showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (slot.sessionId) {
    return (
      <Btn className={className} variant={slot.state === 'draft' ? 'primary' : 'secondary'} onClick={() => navigate(`/campus/seances/${slot.sessionId}`)}>
        {slot.state === 'draft' && boot.me.staff ? 'Continuer' : compact ? 'Voir' : 'Voir la feuille'}
      </Btn>
    )
  }
  if (!boot.me.staff || slot.state === 'cancelled') return null
  return (
    <>
      <Btn className={className} variant={slot.state === 'upcoming' ? 'secondary' : 'primary'} busy={busy} onClick={() => open()}>
        {compact ? 'Ouvrir' : 'Ouvrir la feuille'}
      </Btn>
      {asking && <TeacherDialog slot={slot} onClose={() => setAsking(false)} onChosen={(teacherId) => open({ teacherId })} />}
      {overlap && (
        <Dialog
          title="Un autre cours à cette heure"
          onClose={() => setOverlap(null)}
          footer={
            <>
              <Btn onClick={() => setOverlap(null)}>Retour</Btn>
              <Btn variant="primary" busy={busy} onClick={() => open({ ...overlap.extra, force: true })}>
                Ouvrir quand même
              </Btn>
            </>
          }
        >
          <p className="text-sm text-ink">{overlap.message}</p>
        </Dialog>
      )}
    </>
  )
}
