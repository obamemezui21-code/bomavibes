import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addNamed, createSession, updateSession } from '../../firebase/campus.js'
import { searchKey } from '../../lib/campus.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { Btn, Dialog, Field } from './campusUi.jsx'

// A subject or a teacher: picked in the list, or typed if it's a new one.
function NamePicker({ kind, label, list, value, onChange, placeholder }) {
  const listId = `campus-${kind}`
  return (
    <Field label={label}>
      <input className={fieldClass} list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required maxLength={100} autoComplete="off" />
      <datalist id={listId}>
        {list.map((x) => (
          <option key={x.id} value={x.name} />
        ))}
      </datalist>
    </Field>
  )
}

// Creating a session, or changing its details. `session`: the one to change.
function SessionForm({ session, onClose, onSaved }) {
  const { boot, cls, reload } = useCampus()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => ({
    date: session?.date || boot.today,
    start: session?.start || '08:00',
    end: session?.end || '10:00',
    subject: session?.subjectName || '',
    teacher: session?.teacherName || '',
    reason: '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (v) => {
    setError(null)
    setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))
  }
  const subjects = boot.subjects.filter((s) => s.active)
  const teachers = boot.teachers.filter((t) => t.active)
  const validated = session?.status === 'validated'

  // The one in the catalogue, whatever its accents and capitals; a new name is added.
  async function idOf(kind, list, name) {
    const found = list.find((x) => searchKey(x.name) === searchKey(name))
    return found ? found.id : (await addNamed(kind, name)).id
  }

  async function submit(e, force = false) {
    e?.preventDefault()
    if (form.end <= form.start) return setError({ message: 'L’heure de fin doit venir après l’heure de début.' })
    setBusy(true)
    setError(null)
    try {
      const subjectId = await idOf('subjects', boot.subjects, form.subject)
      const teacherId = await idOf('teachers', boot.teachers, form.teacher)
      const body = { date: form.date, start: form.start, end: form.end, subjectId, teacherId, force, ...(validated ? { reason: form.reason } : {}) }
      if (session) await updateSession(session.id, body)
      else {
        const { id } = await createSession({ ...body, classId: cls.id })
        showToast('Séance créée.', 'success')
        reload().catch(() => {})
        return navigate(`/campus/seances/${id}`)
      }
      reload().catch(() => {})
      showToast('Séance modifiée.', 'success')
      onSaved?.()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
    return undefined
  }

  return (
    <Dialog
      title={session ? 'Modifier la séance' : 'Nouvelle séance'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" busy={busy} type="submit" form="campus-session-form">
            {session ? 'Enregistrer' : 'Créer la séance'}
          </Btn>
        </>
      }
    >
      <form id="campus-session-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-soft">
          {boot.org} · Classe <b className="text-ink">{cls.code}</b> ({cls.label})
        </p>
        <NamePicker kind="subjects" label="Matière" list={subjects} value={form.subject} onChange={set('subject')} placeholder="Choisir ou saisir une matière" />
        <NamePicker kind="teachers" label="Enseignant" list={teachers} value={form.teacher} onChange={set('teacher')} placeholder="Choisir ou saisir un nom" />
        <Field label="Date du cours">
          <input type="date" className={fieldClass} value={form.date} onChange={set('date')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure de début">
            <input type="time" className={fieldClass} value={form.start} onChange={set('start')} required />
          </Field>
          <Field label="Heure de fin">
            <input type="time" className={fieldClass} value={form.end} onChange={set('end')} required />
          </Field>
        </div>
        {validated && (
          <Field label="Motif de la modification" hint="Cette feuille est validée : l’ancienne valeur et le motif sont conservés.">
            <input className={fieldClass} value={form.reason} onChange={set('reason')} required minLength={3} maxLength={300} />
          </Field>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3.5 py-3 text-sm text-coral-600 dark:text-coral-400">
            <p>{error.message}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {error.data?.sessionId && (
                <Btn onClick={() => navigate(`/campus/seances/${error.data.sessionId}`)}>Ouvrir la séance existante</Btn>
              )}
              {error.code === 'OVERLAP' && (
                <Btn busy={busy} onClick={() => submit(null, true)}>
                  Continuer quand même
                </Btn>
              )}
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}

export default SessionForm
