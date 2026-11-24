import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, CheckCircle2, CloudOff, History, Image as ImageIcon, Keyboard, Loader2, LockOpen, MessageSquarePlus, Pencil, RefreshCw, RotateCcw, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { cancelSession, correctMark, deleteSession, fetchSession, fetchSessionAudit, reopenSession, restoreSession, syncRoster, updateSheetStudents, validateSession } from '../../firebase/campus.js'
import { STATUS, UNSET, countJustified, countMarks, dateTime, hours, longDate, matchesSearch, percent, statusLabel } from '../../lib/campus.js'
import { blankSheetReport, filledSheetReport } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { useMarks } from './useMarks.js'
import AuditList from './AuditList.jsx'
import ScanPanel from './ScanPanel.jsx'
import SessionForm from './SessionForm.jsx'
import { EvaluationTag } from './slotUi.jsx'
import { ReasonDialog as AdminDialog, SheetStudentsDialog } from './adminUi.jsx'
import { PermissionDialog, PermissionTag } from './permissionUi.jsx'
import { Btn, CountsLine, Dialog, Empty, ErrorNote, ExportButtons, Field, Loading, Panel, SearchBox, SessionPill, StatusButtons, StatusPill } from './campusUi.jsx'

// One line of the sheet. Memoised: pressing a button redraws one line, not 119.
const Row = memo(function Row({ student, mark, permission, editable, active, correctable, justifiable, onJustify, onMark, onNote, onCorrect, onFocus, noteOpen, onToggleNote }) {
  const status = mark?.s ?? null
  const note = mark?.n || ''
  const excused = !!permission?.full
  return (
    <li
      id={`row-${student.id}`}
      onPointerDown={() => onFocus(student.id)}
      className={`scroll-mb-32 scroll-mt-44 rounded-xl border px-3 py-2 desktop:py-1 ${active ? 'border-violet-400 bg-violet-500/[0.06]' : status ? 'border-ink/8 bg-surface' : 'border-dashed border-ink/15 bg-surface'}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-soft">{student.no}</span>
        <span className="min-w-40 flex-1 text-sm font-medium text-ink">
          {student.name}
          {!editable && note && <span className="block text-xs font-normal text-ink-soft">{note}</span>}
          {!editable && mark?.auto && <span className="block text-xs font-normal text-ink-soft">{status === 'A' ? 'absent d’après sa permission' : 'présent par déduction'}</span>}
          {permission && (
            <span className="mt-0.5 block">
              <PermissionTag permission={permission} />
            </span>
          )}
        </span>
        {editable ? (
          <span className="flex w-full items-center gap-1.5 sm:w-auto">
            <StatusButtons value={status} name={student.name} onChange={(s) => onMark(student.id, s)} />
            <button
              type="button"
              onClick={() => onToggleNote(student.id)}
              aria-label={`Motif ou commentaire pour ${student.name}`}
              aria-expanded={noteOpen}
              className={`flex h-11 w-10 items-center justify-center rounded-xl transition hover:bg-ink/5 ${note ? 'text-violet-600' : 'text-ink-soft'}`}
            >
              <MessageSquarePlus size={18} />
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <StatusPill status={status} justified={excused} />
            {justifiable && status === 'A' && !excused && (
              <Btn variant="ghost" icon={ShieldCheck} onClick={() => onJustify(student)} aria-label={`Justifier l’absence de ${student.name}`}>
                Justifier
              </Btn>
            )}
            {correctable && (
              <Btn variant="ghost" icon={Pencil} onClick={() => onCorrect(student)} aria-label={`Corriger ${student.name}`}>
                Corriger
              </Btn>
            )}
          </span>
        )}
      </div>
      {editable && (noteOpen || note) && (
        <input
          className="mt-2 h-10 w-full rounded-lg border border-ink/12 bg-surface px-3 text-sm text-ink outline-none focus:border-violet-400"
          value={note}
          maxLength={300}
          placeholder="Motif d’absence ou commentaire"
          aria-label={`Motif pour ${student.name}`}
          onChange={(e) => onNote(student.id, e.target.value)}
        />
      )}
    </li>
  )
})

function SaveState({ state, waiting }) {
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-mint-600 dark:text-mint-400">
        <CheckCircle2 size={14} /> Enregistré
      </span>
    )
  }
  if (state === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
        <CloudOff size={14} /> Hors connexion : {waiting} saisie{waiting > 1 ? 's' : ''} gardée{waiting > 1 ? 's' : ''} sur cet appareil
      </span>
    )
  }
  if (state === 'refused') return <span className="text-coral-500">Non enregistré</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-soft">
      <Loader2 size={14} className="animate-spin" /> Enregistrement…
    </span>
  )
}

// The students with no status: present, since the absent and the late were
// noted — or left as they are. Chosen here, each time.
function ValidateDialog({ roster, marks, permissions, counts, onClose, onConfirm, busy }) {
  const [choice, setChoice] = useState('present')
  const [sure, setSure] = useState(false)
  const empty = roster.filter((r) => !marks[r.id]?.s)
  // Allowed to be away for the whole course: absent (justified), not present.
  const away = empty.filter((r) => permissions[r.id]?.full)
  const noted = empty.filter((r) => marks[r.id]?.n)
  const untouched = empty.length === roster.length
  const fill = empty.length > 0 && choice === 'present'
  const shown = fill ? { ...counts, p: counts.p + empty.length - away.length, a: counts.a + away.length, n: 0 } : counts
  const justified = countJustified(roster, marks, permissions) + (fill ? away.length : 0)
  const people = `${empty.length} étudiant${empty.length > 1 ? 's' : ''}`
  return (
    <Dialog
      title="Valider la feuille de présence ?"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Continuer la saisie</Btn>
          <Btn variant="primary" busy={busy} disabled={fill ? !sure : empty.length > 0 && untouched} onClick={() => onConfirm(empty.length ? (fill ? { fillPresent: true } : { allowUnfilled: true }) : {})}>
            Valider définitivement
          </Btn>
        </>
      }
    >
      <CountsLine counts={shown} justified={justified} className="text-sm" />
      <p className="mt-3 text-sm text-ink-soft">Après validation, la feuille compte dans les statistiques. Chaque correction demandera un motif et restera dans l’historique.</p>
      {empty.length > 0 && (
        <fieldset className="mt-4 space-y-3 rounded-xl border border-ink/12 p-3 text-sm text-ink">
          <legend className="px-1 font-semibold">{people} sans statut</legend>
          {untouched && <p className="rounded-lg bg-amber-400/10 px-2.5 py-2">Aucun absent ni retard n’est saisi : toute la classe sera marquée présente.</p>}
          <label className="flex items-start gap-2">
            <input type="radio" name="campus-empty" className="mt-0.5 h-4 w-4 accent-violet-600" checked={choice === 'present'} onChange={() => setChoice('present')} />
            <span>
              <b className="font-semibold">Les marquer présents</b>
              <span className="block text-xs text-ink-soft">Les absents et les retards sont relevés : les autres étaient là.</span>
            </span>
          </label>
          {!untouched && (
            <label className="flex items-start gap-2">
              <input type="radio" name="campus-empty" className="mt-0.5 h-4 w-4 accent-violet-600" checked={choice === 'leave'} onChange={() => setChoice('leave')} />
              <span>
                <b className="font-semibold">Les laisser « {UNSET} »</b>
                <span className="block text-xs text-ink-soft">Ni présents ni absents dans les statistiques.</span>
              </span>
            </label>
          )}
          {fill && away.length > 0 && (
            <p className="rounded-lg bg-sky-500/10 px-2.5 py-2 text-xs">
              Permission pour tout le cours, {away.length > 1 ? 'marqués absents justifiés' : 'marqué absent justifié'} : {away.map((r) => r.name).join(', ')}.
            </p>
          )}
          {fill && noted.length > 0 && (
            <p className="rounded-lg bg-amber-400/10 px-2.5 py-2 text-xs">
              À vérifier, un commentaire sans statut : {noted.map((r) => `${r.name} (« ${marks[r.id].n} »)`).join(', ')}.
            </p>
          )}
          <details className="text-xs text-ink-soft">
            <summary className="cursor-pointer font-semibold">Voir les {people}</summary>
            <ul className="mt-1 max-h-32 overflow-y-auto">
              {empty.map((r) => (
                <li key={r.id}>
                  {r.no}. {r.name}
                </li>
              ))}
            </ul>
          </details>
          {fill && (
            <label className="flex items-start gap-2 border-t border-ink/8 pt-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              <span>
                J’ai relevé <b className="font-semibold">tous</b> les absents ({counts.a}) et <b className="font-semibold">tous</b> les retards ({counts.r}) de la feuille.
              </span>
            </label>
          )}
        </fieldset>
      )}
    </Dialog>
  )
}

function CorrectDialog({ session, student, onClose, onDone }) {
  const { showToast } = useToast()
  const mark = session.marks[student.id] || { s: null, n: '' }
  const [status, setStatus] = useState(mark.s)
  const [note, setNote] = useState(mark.n || '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const changed = status !== mark.s || note.trim() !== (mark.n || '')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await correctMark(session.id, { studentId: student.id, from: mark.s, s: status, n: note.trim(), reason: reason.trim() })
      showToast('Correction enregistrée.', 'success')
      await onDone()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Corriger un statut"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-correct" busy={busy} disabled={!changed || reason.trim().length < 3}>
            Enregistrer la correction
          </Btn>
        </>
      }
    >
      <form id="campus-correct" onSubmit={submit} className="space-y-4">
        <p className="text-sm font-semibold text-ink">{student.name}</p>
        <p className="text-sm text-ink-soft">
          {statusLabel(mark.s)} → <b className="text-ink">{statusLabel(status)}</b>
        </p>
        <StatusButtons value={status} name={student.name} onChange={setStatus} />
        <Field label="Motif d’absence ou commentaire">
          <input className={fieldClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Motif de la correction (obligatoire)" hint="L’ancienne valeur, la nouvelle, la date, votre nom et ce motif sont conservés.">
          <input className={fieldClass} value={reason} maxLength={300} required minLength={3} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  )
}

function ReasonDialog({ title, text, label, confirm, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const done = await onConfirm(reason.trim())
    if (!done) setBusy(false)
  }
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Retour</Btn>
          <Btn variant="danger" type="submit" form="campus-reason" busy={busy} disabled={reason.trim().length < 3}>
            {confirm}
          </Btn>
        </>
      }
    >
      <form id="campus-reason" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-soft">{text}</p>
        <Field label={label}>
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required minLength={3} />
        </Field>
      </form>
    </Dialog>
  )
}

const FILTERS = [
  ['', 'Tous'],
  ['N', 'Non renseignés'],
  ['P', STATUS.P.plural],
  ['R', STATUS.R.plural],
  ['A', STATUS.A.plural],
  ['J', 'Absents justifiés'],
  ['U', 'Non justifiés'],
]

function Sheet({ data, reload }) {
  const { session, can, classLabel } = data
  const { boot } = useCampus()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const editable = can.enter
  const rosterIds = useMemo(() => session.roster.map((r) => r.id), [session.roster])
  const onRefused = useCallback(
    (err) => {
      showToast(err.message, 'error')
      reload()
    },
    [reload, showToast],
  )
  const onLost = useCallback((n) => showToast(`${n} saisie${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''} hors connexion sur cet appareil n’${n > 1 ? 'ont' : 'a'} pas pu être envoyée${n > 1 ? 's' : ''} : la feuille a été validée entre-temps.`, 'error'), [showToast])
  const { marks, setMark, flush, state, waiting } = useMarks({ sessionId: session.id, uid: boot.me.uid, initial: session.marks, enabled: editable, rosterIds, onRefused, onLost })
  const counts = useMemo(() => countMarks(session.roster, marks), [session.roster, marks])
  const rated = counts.p + counts.r + counts.a
  const justified = useMemo(() => countJustified(session.roster, marks, session.permissions), [session.roster, marks, session.permissions])
  const chipCount = { '': session.roster.length, N: counts.n, P: counts.p, R: counts.r, A: counts.a, J: justified, U: counts.a - justified }

  const [search, setSearch] = useState('')
  // A status filter keeps the students it had when it was chosen: marking one
  // doesn't make the line jump away under the finger.
  const [filter, setFilter] = useState({ key: '', ids: null })
  const [cursor, setCursor] = useState(session.roster[0]?.id)
  const [openNote, setOpenNote] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showScan, setShowScan] = useState(session.scans.length > 0)
  const [audit, setAudit] = useState(null)
  const searchRef = useRef(null)

  const rows = useMemo(() => session.roster.filter((r) => (!filter.ids || filter.ids.has(r.id)) && matchesSearch(search, r)), [session.roster, filter.ids, search])

  function chooseFilter(key) {
    const fits = (r) => {
      const s = marks[r.id]?.s ?? 'N'
      if (key === 'J' || key === 'U') return s === 'A' && !!session.permissions[r.id]?.full === (key === 'J')
      return s === key
    }
    setFilter({ key, ids: key ? new Set(session.roster.filter(fits).map((r) => r.id)) : null })
  }

  const onMark = useCallback((id, s) => setMark(id, { s }), [setMark])
  const onNote = useCallback((id, n) => setMark(id, { n }), [setMark])
  const onFocus = useCallback((id) => setCursor(id), [])
  const onToggleNote = useCallback((id) => setOpenNote((o) => (o === id ? null : id)), [])
  const onJustify = useCallback((student) => setDialog({ type: 'justify', student }), [])
  const onCorrect = useCallback((student) => setDialog({ type: 'correct', student }), [])

  // Keyboard entry: P, R, A (or 1, 2, 3) sets the status and goes to the next
  // student; arrows move; Delete clears; « / » searches; M opens the comment.
  useEffect(() => {
    if (!editable) return undefined
    function move(step) {
      const i = rows.findIndex((r) => r.id === cursor)
      const next = rows[Math.max(0, Math.min(rows.length - 1, i + step))]
      if (!next) return
      setCursor(next.id)
      document.getElementById(`row-${next.id}`)?.scrollIntoView({ block: 'nearest' })
    }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[data-campus-dialog]')) return
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (typing) {
        // From the search box: Enter goes to the first student found.
        if (e.target === searchRef.current && e.key === 'Enter' && rows[0]) {
          e.preventDefault()
          setCursor(rows[0].id)
          e.target.blur()
        } else if (e.key === 'Escape') e.target.blur()
        return
      }
      const status = { p: 'P', r: 'R', a: 'A', 1: 'P', 2: 'R', 3: 'A' }[e.key.toLowerCase()]
      if (status) {
        e.preventDefault()
        if (!rows.some((r) => r.id === cursor)) return
        setMark(cursor, { s: status })
        move(1)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        move(e.key === 'ArrowDown' ? 1 : -1)
      } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
        e.preventDefault()
        if (rows.some((r) => r.id === cursor)) setMark(cursor, { s: null })
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setOpenNote(cursor)
        setTimeout(() => document.querySelector(`#row-${cursor} input`)?.focus(), 30)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editable, rows, cursor, setMark])

  // After a search or a filter, the current line is one that shows.
  useEffect(() => {
    if (rows.length && !rows.some((r) => r.id === cursor)) setCursor(rows[0].id)
  }, [rows, cursor])

  async function validate(choice) {
    setBusy(true)
    try {
      // Everything entered must have reached the server first.
      if (!(await flush())) throw new Error('Certaines saisies ne sont pas encore enregistrées. Vérifiez la connexion, puis réessayez.')
      const { filled, excused } = await validateSession(session.id, { confirmed: true, ...choice })
      showToast(filled || excused ? `Feuille validée : ${filled} présents complétés${excused ? `, ${excused} absent${excused > 1 ? 's' : ''} avec permission` : ''}.` : 'Feuille validée et enregistrée.', 'success')
      setDialog(null)
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
      if (err.code === 'VALIDATED') await reload()
    } finally {
      setBusy(false)
    }
  }

  async function cancel(reason) {
    try {
      await cancelSession(session.id, reason)
      showToast('Feuille annulée. Elle reste dans les archives.', 'success')
      setDialog(null)
      await reload()
      return true
    } catch (err) {
      showToast(err.message, 'error')
      return false
    }
  }

  async function sync() {
    setBusy(true)
    try {
      await flush()
      await syncRoster(session.id)
      showToast('Liste de la feuille mise à jour.', 'success')
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // An administrator's action: done, said, and the sheet read again.
  const admin = (action, message) => async (reason) => {
    if (editable) await flush()
    await action(session.id, reason)
    showToast(message, 'success')
    setDialog(null)
    await reload()
  }

  async function openAudit() {
    setDialog({ type: 'audit' })
    setAudit(null)
    try {
      setAudit(await fetchSessionAudit(session.id))
    } catch (err) {
      showToast(err.message, 'error')
      setDialog(null)
    }
  }

  const current = { ...session, marks, counts, justified }
  return (
    <div className="space-y-4 pb-28">
      <button type="button" onClick={() => navigate('/campus/seances')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Séances
      </button>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-ink">
              {session.subjectName} {session.kind === 'evaluation' && <EvaluationTag />} <SessionPill status={session.status} />
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              <span className="inline-block first-letter:uppercase">{longDate(session.date)}</span>, {hours(session)} · {session.teacherName}
            </p>
            <p className="text-sm text-ink-soft">
              {session.org} · Classe {session.classCode} · Effectif attendu : {session.roster.length} · Saisie : {session.agentName}
              {session.validatedAt && ` · Validée le ${dateTime(session.validatedAt)} par ${session.validatedBy}`}
            </p>
            {session.status === 'cancelled' && (
              <p className="mt-1 text-sm font-medium text-coral-500">
                Annulée le {dateTime(session.cancelledAt)} par {session.cancelledBy} : {session.cancelReason}. Elle ne compte pas dans les statistiques.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {can.details && (
              <Btn icon={Pencil} onClick={() => setDialog({ type: 'details' })}>
                Modifier
              </Btn>
            )}
            <Btn icon={History} onClick={openAudit}>
              Historique{session.corrections > 0 ? ` (${session.corrections})` : ''}
            </Btn>
            {can.cancel && (
              <Btn variant="ghost" icon={Ban} onClick={() => setDialog({ type: 'cancel' })}>
                Annuler la feuille
              </Btn>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CountsLine counts={counts} justified={justified} />
            <span className="text-xs text-ink-soft">
              Présence <b className="text-ink">{percent(rated ? (counts.p + counts.r) / rated : null)}</b>
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {editable && <ExportButtons label="Feuille vierge " excel={false} print={false} report={() => blankSheetReport({ session: current, classLabel })} />}
            <ExportButtons report={() => filledSheetReport({ session: current, classLabel, marks })} />
          </div>
        </div>
      </Panel>

      {can.admin && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 bg-surface px-4 py-3">
          <span className="mr-1 text-xs font-semibold text-ink-soft">Administrateur</span>
          {session.status === 'validated' && (
            <Btn icon={LockOpen} onClick={() => setDialog({ type: 'reopen' })}>
              Rouvrir la saisie
            </Btn>
          )}
          {session.status === 'cancelled' && (
            <Btn icon={RotateCcw} onClick={() => setDialog({ type: 'restore' })}>
              Rétablir la feuille
            </Btn>
          )}
          {session.status !== 'cancelled' && (
            <Btn icon={UsersRound} onClick={() => setDialog({ type: 'students' })}>
              Ajouter ou retirer des étudiants
            </Btn>
          )}
          <Btn variant="ghost" icon={Trash2} className="!text-coral-600 dark:!text-coral-400" onClick={() => setDialog({ type: 'delete' })}>
            Supprimer
          </Btn>
        </div>
      )}

      {data.rosterOutdated && editable && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-ink">
          <span>La liste officielle a changé depuis la création de cette séance.</span>
          <Btn icon={RefreshCw} busy={busy} onClick={sync}>
            Mettre la feuille à jour
          </Btn>
        </div>
      )}
      {data.future && editable && <p className="rounded-2xl border border-ink/10 bg-surface px-4 py-3 text-sm text-ink-soft">Cette séance n’a pas encore eu lieu : elle pourra être validée à partir de sa date.</p>}

      {editable && <p className="text-sm text-ink-soft">Relevez les absents et les retards : à la validation, vous pourrez marquer présents tous les autres d’un coup.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Btn icon={ImageIcon} aria-expanded={showScan} onClick={() => setShowScan((v) => !v)}>
          {showScan ? 'Masquer la feuille papier' : `Feuille papier${session.scans.length ? ` (${session.scans.length})` : ''}`}
        </Btn>
        {editable && (
          <span className="hidden items-center gap-1.5 text-xs text-ink-soft desktop:inline-flex">
            <Keyboard size={14} /> P, R, A : statut puis étudiant suivant · flèches : se déplacer · Suppr : effacer · M : motif · / : rechercher
          </span>
        )}
      </div>

      <div className={showScan ? 'gap-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start' : ''}>
        {showScan && (
          <Panel title="Feuille papier" className="mb-4 lg:sticky lg:top-32 lg:mb-0">
            <ScanPanel session={session} canEdit={can.scans} onChanged={() => flush().then(() => reload(true))} />
          </Panel>
        )}
        <div className="min-w-0">
          <div className="sticky top-[6.6rem] z-10 -mx-1 space-y-2 bg-surface-soft px-1 pb-2 pt-1">
            <SearchBox value={search} onChange={setSearch} inputRef={searchRef} />
            <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrer par statut">
              {FILTERS.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter.key === key} onClick={() => chooseFilter(key)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter.key === key ? 'border-violet-950 bg-violet-950 text-white dark:border-violet-600 dark:bg-violet-600' : 'border-ink/12 bg-surface text-ink-soft'}`}>
                  {label} {chipCount[key]}
                </button>
              ))}
            </div>
          </div>
          {rows.length ? (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <Row
                  key={r.id}
                  student={r}
                  mark={marks[r.id]}
                  permission={session.permissions[r.id]}
                  editable={editable}
                  active={editable && cursor === r.id}
                  correctable={can.correct}
                  justifiable={can.permit}
                  onJustify={onJustify}
                  onMark={onMark}
                  onNote={onNote}
                  onCorrect={onCorrect}
                  onFocus={onFocus}
                  noteOpen={openNote === r.id}
                  onToggleNote={onToggleNote}
                />
              ))}
            </ul>
          ) : (
            <Empty>{search ? 'Aucun étudiant trouvé.' : 'Aucun étudiant dans ce filtre.'}</Empty>
          )}
        </div>
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-xs font-medium">
              <p className="text-sm text-ink">
                <b>{rated}</b> / {session.roster.length} renseignés
              </p>
              <SaveState state={state} waiting={waiting} />
            </div>
            <Btn variant="primary" icon={CheckCircle2} disabled={data.future} onClick={() => setDialog({ type: 'validate' })}>
              Valider la feuille
            </Btn>
          </div>
        </div>
      )}

      {dialog?.type === 'validate' && <ValidateDialog roster={session.roster} marks={marks} permissions={session.permissions} counts={counts} busy={busy} onClose={() => setDialog(null)} onConfirm={validate} />}
      {dialog?.type === 'correct' && (
        <CorrectDialog
          session={session}
          student={dialog.student}
          onClose={() => setDialog(null)}
          onDone={async () => {
            setDialog(null)
            await reload()
          }}
        />
      )}
      {dialog?.type === 'details' && (
        <SessionForm
          session={session}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null)
            await flush()
            await reload(true)
          }}
        />
      )}
      {dialog?.type === 'cancel' && (
        <ReasonDialog title="Annuler cette feuille ?" text="Elle n’est pas supprimée : elle reste dans les archives avec le motif, et ne compte plus dans les statistiques." label="Motif de l’annulation" confirm="Annuler la feuille" onClose={() => setDialog(null)} onConfirm={cancel} />
      )}
      {dialog?.type === 'justify' && (
        <PermissionDialog
          student={dialog.student}
          start={{ type: 'absence', startDate: session.date, endDate: session.date, startTime: '00:00', endTime: '23:59' }}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null)
            await reload()
          }}
        />
      )}
      {dialog?.type === 'reopen' && (
        <AdminDialog title="Rouvrir cette feuille ?" text="Les statuts restent. La feuille ne compte plus dans les statistiques tant qu’elle n’est pas validée de nouveau." confirm="Rouvrir" danger={false} onClose={() => setDialog(null)} onConfirm={admin(reopenSession, 'Feuille rouverte.')} />
      )}
      {dialog?.type === 'restore' && <AdminDialog title="Rétablir cette feuille ?" text="Elle revient telle qu’elle était avant son annulation." confirm="Rétablir" danger={false} onClose={() => setDialog(null)} onConfirm={admin(restoreSession, 'Feuille rétablie.')} />}
      {dialog?.type === 'students' && <SheetStudentsDialog session={session} marks={marks} onClose={() => setDialog(null)} onConfirm={(body) => admin((id) => updateSheetStudents(id, body), 'Étudiants de la feuille mis à jour.')(body.reason)} />}
      {dialog?.type === 'delete' && (
        <AdminDialog
          title="Supprimer cette feuille ?"
          text="Elle va dans la corbeille, avec ses statuts et ses images. Vous pourrez la restaurer ou l’effacer définitivement dans Administration → Corbeille."
          confirm="Supprimer"
          typed={session.status === 'validated'}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await deleteSession(session.id, reason)
            showToast('Feuille mise à la corbeille.', 'success')
            navigate('/campus/seances', { replace: true })
          }}
        />
      )}
      {dialog?.type === 'audit' && (
        <Dialog title="Historique de la séance" onClose={() => setDialog(null)} wide>
          {audit ? <AuditList entries={audit} /> : <Loading />}
        </Dialog>
      )}
    </div>
  )
}

function SessionSheet() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  // keep: same marks on screen (only the details or the images changed).
  const load = useCallback(
    async (keep = false) => {
      try {
        const d = await fetchSession(id)
        setData(d)
        setError('')
        if (!keep) setVersion((v) => v + 1)
      } catch (err) {
        setError(err.message)
      }
    },
    [id],
  )
  useEffect(() => {
    setData(null)
    load()
  }, [load])

  if (error && !data) return <ErrorNote onRetry={() => load()}>{error}</ErrorNote>
  if (!data || data.session.id !== id) return <Loading />
  return <Sheet key={`${id}-${version}`} data={data} reload={load} />
}

export default SessionSheet
