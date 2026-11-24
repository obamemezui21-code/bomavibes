import { useState } from 'react'
import { Ban, CheckCircle2, Pencil, ShieldCheck } from 'lucide-react'
import { cancelPermission, createPermission, updatePermission } from '../../firebase/campus.js'
import { CATEGORIES, PERMISSION_TYPES, hours, matchesSearch, permissionPeriod, shortDate } from '../../lib/campus.js'
import { permissionSlip } from '../../lib/campusReports.js'
import { useToast } from '../../context/ToastContext.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import { ReasonDialog } from './adminUi.jsx'
import { Btn, Dialog, ExportButtons, Field, SearchBox } from './campusUi.jsx'

// Permissions to leave and justified absences: shared by their page, the
// student's page and the sheets.

export function PermissionTag({ permission }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
      <ShieldCheck size={11} strokeWidth={2.75} aria-hidden="true" />
      {permission.type === 'exit' ? 'Sortie autorisée' : 'Absence autorisée'} {permissionPeriod(permission)}
      {permission.full === false && ' (une partie du cours)'}
    </span>
  )
}

const split = (dt) => [dt.slice(0, 10), dt.slice(11, 16)]

/**
 * A new permission, or one to change. student: fixed ({ id, name }), or picked
 * in `students`. start: { type, startDate, endDate, startTime, endTime }, what
 * the form opens with. The absences it will justify are shown before saving.
 */
export function PermissionDialog({ permission, student, students, start, onClose, onSaved }) {
  const { boot } = useCampus()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => {
    if (permission) {
      const [startDate, startTime] = split(permission.start)
      const [endDate, endTime] = split(permission.end)
      return { type: permission.type, startDate, endDate, startTime, endTime, category: permission.category, details: permission.details, proof: permission.proof, authority: permission.authority }
    }
    return { type: 'exit', startDate: boot.today, endDate: boot.today, startTime: '10:00', endTime: '16:00', category: '', details: '', proof: false, authority: boot.me.name, ...start }
  })
  const [studentId, setStudentId] = useState(student?.id || '')
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => {
    setPreview(null)
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: value, ...(k === 'startDate' && (f.type === 'exit' || f.endDate < value) ? { endDate: value } : {}) }))
  }
  function setType(type) {
    setPreview(null)
    setForm((f) => ({ ...f, type, ...(type === 'absence' ? { startTime: '00:00', endTime: '23:59' } : { endDate: f.startDate, startTime: f.startTime === '00:00' ? '10:00' : f.startTime, endTime: f.endTime === '23:59' ? '16:00' : f.endTime }) }))
  }
  const found = (students || []).filter((s) => s.active && matchesSearch(search, s))
  const name = student?.name || students?.find((s) => s.id === studentId)?.name || ''

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (permission) {
        await updatePermission(permission.id, { ...form, reason: reason.trim() })
        showToast('Permission modifiée.', 'success')
        onSaved()
      } else if (!preview) {
        setPreview(await createPermission({ ...form, studentId, dryRun: true }))
        setBusy(false)
      } else {
        const { affected } = await createPermission({ ...form, studentId })
        showToast(affected.length ? `Permission enregistrée : ${affected.length} absence${affected.length > 1 ? 's' : ''} justifiée${affected.length > 1 ? 's' : ''}.` : 'Permission enregistrée.', 'success')
        onSaved()
      }
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={permission ? 'Modifier la permission' : 'Nouvelle permission'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={preview ? () => setPreview(null) : onClose}>{preview ? 'Revenir' : 'Annuler'}</Btn>
          <Btn variant="primary" type="submit" form="campus-permission" busy={busy} disabled={!studentId && !permission}>
            {permission ? 'Enregistrer' : preview ? 'Accorder la permission' : 'Continuer'}
          </Btn>
        </>
      }
    >
      <form id="campus-permission" onSubmit={submit} className="space-y-3">
        {preview ? (
          <div className="space-y-3 text-sm text-ink">
            <p>
              <b className="font-semibold">{name}</b>
              <span className="block text-ink-soft">
                {PERMISSION_TYPES[form.type]}, {permissionPeriod({ type: form.type, start: `${form.startDate}T${form.startTime}`, end: `${form.endDate}T${form.endTime}` })} · {CATEGORIES[form.category]} · accordée par {form.authority}
              </span>
            </p>
            {preview.affected.length > 0 ? (
              <div className="rounded-xl bg-sky-500/10 p-3">
                <p className="font-semibold">
                  {preview.affected.length} absence{preview.affected.length > 1 ? 's' : ''} déjà enregistrée{preview.affected.length > 1 ? 's' : ''} {preview.affected.length > 1 ? 'deviendront justifiées' : 'deviendra justifiée'} :
                </p>
                <ul className="mt-1 text-xs text-ink-soft">
                  {preview.affected.map((a) => (
                    <li key={a.sessionId}>
                      {shortDate(a.date)}, {hours(a)}, {a.subjectName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-ink-soft">Aucune absence déjà enregistrée n’est concernée. Celles à venir dans cette période seront justifiées.</p>
            )}
            {preview.partial.length > 0 && (
              <div className="rounded-xl bg-amber-400/10 p-3">
                <p className="font-semibold">Couverts en partie seulement : une absence n’y sera pas justifiée d’office.</p>
                <ul className="mt-1 text-xs text-ink-soft">
                  {preview.partial.map((a) => (
                    <li key={`${a.date}${a.start}`}>
                      {shortDate(a.date)}, {hours(a)}, {a.subjectName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            {student || permission ? (
              <p className="text-sm font-semibold text-ink">{student?.name || permission.studentName}</p>
            ) : (
              <>
                <SearchBox value={search} onChange={setSearch} />
                <Field label="Étudiant">
                  <select className={fieldClass} value={found.some((s) => s.id === studentId) ? studentId : ''} onChange={(e) => setStudentId(e.target.value)} required>
                    <option value="">{found.length ? `Choisir (${found.length})` : 'Aucun étudiant trouvé'}</option>
                    {found.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
              {Object.entries(PERMISSION_TYPES).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={form.type === key} onClick={() => setType(key)} className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${form.type === key ? 'border-violet-600 bg-violet-500/10 text-ink' : 'border-ink/12 text-ink-soft'}`}>
                  {label}
                  <span className="block text-xs font-normal">{key === 'exit' ? 'quelques heures' : 'un ou plusieurs jours'}</span>
                </button>
              ))}
            </div>
            {form.type === 'exit' ? (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Jour">
                  <input type="date" className={`${fieldClass} !px-2`} value={form.startDate} onChange={set('startDate')} required />
                </Field>
                <Field label="Sortie">
                  <input type="time" className={`${fieldClass} !px-2`} value={form.startTime} onChange={set('startTime')} required />
                </Field>
                <Field label="Retour">
                  <input type="time" className={`${fieldClass} !px-2`} value={form.endTime} onChange={set('endTime')} required />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Du">
                  <input type="date" className={fieldClass} value={form.startDate} onChange={set('startDate')} required />
                </Field>
                <Field label="Au (inclus)">
                  <input type="date" className={fieldClass} value={form.endDate} min={form.startDate} onChange={set('endDate')} required />
                </Field>
              </div>
            )}
            <Field label="Motif">
              <select className={fieldClass} value={form.category} onChange={set('category')} required>
                <option value="">Choisir</option>
                {Object.entries(CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Précisions" hint="Facultatif. Visibles seulement par les personnes qui accordent les permissions.">
              <input className={fieldClass} value={form.details} onChange={set('details')} maxLength={300} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={form.proof} onChange={set('proof')} />
              Justificatif papier remis (certificat, convocation…)
            </label>
            <Field label="Accordée par">
              <input className={fieldClass} value={form.authority} onChange={set('authority')} required minLength={2} maxLength={100} />
            </Field>
            {permission && (
              <Field label="Motif de la modification">
                <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} />
              </Field>
            )}
          </>
        )}
      </form>
    </Dialog>
  )
}

// One permission in a list, with what may be done of it.
export function PermissionItem({ permission: p, showName, onChanged }) {
  const { boot, cls } = useCampus()
  const { showToast } = useToast()
  const [dialog, setDialog] = useState(null)
  const active = p.status === 'active'
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <span className="min-w-56 flex-1">
        {showName && <span className="block text-sm font-semibold text-ink">{p.studentName}</span>}
        <span className={`block text-sm ${active ? 'text-ink' : 'text-ink-soft line-through'}`}>
          {PERMISSION_TYPES[p.type]} · {permissionPeriod(p)}
        </span>
        <span className="block text-xs text-ink-soft">
          {CATEGORIES[p.category]}
          {p.details && ` (${p.details})`} · accordée par {p.authority}
          {p.proof && (
            <span className="ml-1 inline-flex items-center gap-1 align-[-2px] text-mint-600 dark:text-mint-400">
              <CheckCircle2 size={12} /> justificatif remis
            </span>
          )}
        </span>
        {!active && <span className="block text-xs font-medium text-coral-500">Annulée{p.cancelReason && ` : ${p.cancelReason}`}</span>}
      </span>
      {active && (
        <span className="flex flex-wrap gap-1">
          <ExportButtons label="Bulletin " excel={false} print={false} report={() => permissionSlip({ org: boot.org, cls, permission: p })} />
          {boot.me.canPermit && (
            <>
              <Btn variant="ghost" icon={Pencil} aria-label={`Modifier la permission de ${p.studentName}`} onClick={() => setDialog('edit')} />
              <Btn variant="ghost" icon={Ban} aria-label={`Annuler la permission de ${p.studentName}`} onClick={() => setDialog('cancel')} />
            </>
          )}
        </span>
      )}
      {dialog === 'edit' && (
        <PermissionDialog
          permission={p}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            onChanged()
          }}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title="Annuler cette permission ?"
          text={`${p.studentName}, ${permissionPeriod(p)}. Les absences qu’elle justifiait redeviennent non justifiées. La permission reste dans l’historique.`}
          confirm="Annuler la permission"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await cancelPermission(p.id, reason)
            showToast('Permission annulée.', 'success')
            setDialog(null)
            onChanged()
          }}
        />
      )}
    </li>
  )
}
