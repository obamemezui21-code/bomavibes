import { useEffect, useMemo, useState } from 'react'
import { fetchStudents } from '../../firebase/campus.js'
import { matchesSearch, statusLabel } from '../../lib/campus.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass } from './campusContext.js'
import { Btn, Dialog, Field, Loading, SearchBox } from './campusUi.jsx'

const WORD = 'SUPPRIMER'

/**
 * Asks for the reason of an administrator's action. `typed`: the word must be
 * typed too (what is deleted has been validated, or is a whole class).
 * onConfirm(reason) does it; an error is shown and the dialog stays open.
 */
export function ReasonDialog({ title, text, label = 'Motif', confirm, danger = true, typed, children, canConfirm = true, onClose, onConfirm }) {
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = canConfirm && reason.trim().length >= 3 && (!typed || word.trim().toUpperCase() === WORD)

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Retour</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} type="submit" form="campus-admin-reason" busy={busy} disabled={!ready}>
            {confirm}
          </Btn>
        </>
      }
    >
      <form id="campus-admin-reason" onSubmit={submit} className="space-y-3">
        {text && <p className="text-sm text-ink-soft">{text}</p>}
        {children}
        <Field label={label}>
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} />
        </Field>
        {typed && (
          <Field label={`Pour confirmer, écrivez ${WORD}`}>
            <input className={fieldClass} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" required />
          </Field>
        )}
      </form>
    </Dialog>
  )
}

// Who is on one sheet: take students off it, or put others on.
export function SheetStudentsDialog({ session, marks, onClose, onConfirm }) {
  const { showToast } = useToast()
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [remove, setRemove] = useState(() => new Set())
  const [add, setAdd] = useState(() => new Set())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    fetchStudents(session.classId)
      .then((s) => live && setStudents(s))
      .catch((err) => live && showToast(err.message, 'error'))
    return () => {
      live = false
    }
  }, [session.classId, showToast])

  const on = useMemo(() => new Set(session.roster.map((r) => r.id)), [session.roster])
  const toggle = (set, setter, id) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }
  const others = (students || []).filter((s) => !on.has(s.id) && matchesSearch(search, s))
  const listed = session.roster.filter((r) => matchesSearch(search, r))
  const changes = add.size + remove.size
  const lost = [...remove].filter((id) => marks[id]?.s).length

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm({ add: [...add], remove: [...remove], reason: reason.trim() })
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  const row = 'flex items-center gap-2.5 py-1.5 text-sm text-ink'
  const box = 'h-4 w-4 shrink-0 accent-violet-600'
  return (
    <Dialog
      title="Étudiants de cette feuille"
      wide
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Retour</Btn>
          <Btn variant="primary" type="submit" form="campus-sheet-students" busy={busy} disabled={!changes || reason.trim().length < 3}>
            Enregistrer ({changes})
          </Btn>
        </>
      }
    >
      <form id="campus-sheet-students" onSubmit={submit} className="space-y-3">
        <SearchBox value={search} onChange={setSearch} />
        {!students ? (
          <Loading />
        ) : (
          <>
            {others.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-soft">À ajouter (sans statut)</p>
                <ul className="max-h-40 overflow-y-auto">
                  {others.map((s) => (
                    <li key={s.id}>
                      <label className={row}>
                        <input type="checkbox" className={box} checked={add.has(s.id)} onChange={() => toggle(add, setAdd, s.id)} />
                        {s.name} {!s.active && <span className="text-xs text-ink-soft">(archivé)</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-ink-soft">Sur la feuille : décochez pour retirer</p>
              <ul className="max-h-60 overflow-y-auto">
                {listed.map((r) => (
                  <li key={r.id}>
                    <label className={row}>
                      <input type="checkbox" className={box} checked={!remove.has(r.id)} onChange={() => toggle(remove, setRemove, r.id)} />
                      <span className={`flex-1 ${remove.has(r.id) ? 'line-through opacity-60' : ''}`}>
                        {r.no}. {r.name}
                      </span>
                      <span className="text-xs text-ink-soft">{statusLabel(marks[r.id]?.s)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {lost > 0 && (
          <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-ink">
            {lost} statut{lost > 1 ? 's' : ''} enregistré{lost > 1 ? 's' : ''} {lost > 1 ? 'seront retirés' : 'sera retiré'} avec {lost > 1 ? 'ces étudiants' : 'cet étudiant'}. {lost > 1 ? 'Ils restent' : 'Il reste'} dans l’historique.
          </p>
        )}
        <Field label="Motif">
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} />
        </Field>
      </form>
    </Dialog>
  )
}

// A subject or teacher in use is replaced everywhere before it goes.
export function DeleteNamedDialog({ what, item, others, onClose, onDelete }) {
  const [usage, setUsage] = useState(null)
  const [replaceBy, setReplaceBy] = useState('')
  async function confirm(reason) {
    try {
      await onDelete({ reason, replaceBy: replaceBy || null })
    } catch (err) {
      if (err.code === 'IN_USE') setUsage(err.data.usage)
      throw err
    }
  }
  return (
    <ReasonDialog title={`Supprimer « ${item.name} » ?`} text={`${what === 'subjects' ? 'Cette matière' : 'Cet enseignant'} va dans la corbeille.`} confirm="Supprimer" canConfirm={!usage || !!replaceBy} onClose={onClose} onConfirm={confirm}>
      {usage && (
        <div className="rounded-xl bg-amber-400/10 p-3 text-sm text-ink">
          <p>
            Utilisé sur {usage.sheets} feuille{usage.sheets > 1 ? 's' : ''} et {usage.weeks} planning{usage.weeks > 1 ? 's' : ''}. Choisissez par quoi le remplacer partout.
          </p>
        </div>
      )}
      <Field label="Remplacer partout par" hint={usage ? '' : 'Obligatoire seulement s’il est utilisé.'}>
        <select className={fieldClass} value={replaceBy} onChange={(e) => setReplaceBy(e.target.value)}>
          <option value="">{usage ? 'Choisir' : 'Personne : il n’est pas utilisé'}</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
    </ReasonDialog>
  )
}
