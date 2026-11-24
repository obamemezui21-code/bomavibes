import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileUp, Info, Pencil, Plus, RotateCcw, Trash2, UserPlus, XCircle } from 'lucide-react'
import { addNamed, createClass, deleteClass, deleteNamed, fetchAudit, fetchImports, fetchMembers, fetchTrash, previewImport, purgeTrash, removeMember, renameNamed, restoreTrash, runImport, setMember, updateClass, updateNamed } from '../../firebase/campus.js'
import { ROLE_LABELS, TRASH_LABELS, dateTime } from '../../lib/campus.js'
import { useToast } from '../../context/ToastContext.jsx'
import ConfirmModal from '../ui/ConfirmModal.jsx'
import { fieldClass, useCampus } from './campusContext.js'
import AuditList from './AuditList.jsx'
import { DeleteNamedDialog, ReasonDialog } from './adminUi.jsx'
import { Btn, Dialog, Empty, ErrorNote, Field, Loading, Panel } from './campusUi.jsx'

const LEVELS = {
  error: { icon: XCircle, label: 'Erreur', className: 'text-coral-600 dark:text-coral-400' },
  warning: { icon: AlertTriangle, label: 'À vérifier', className: 'text-amber-700 dark:text-amber-300' },
  info: { icon: Info, label: 'Information', className: 'text-ink-soft' },
}

function ReportView({ preview }) {
  const { report, plan, entries } = preview
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-semibold ${report.ok ? 'bg-mint-500/10 text-mint-600 dark:text-mint-400' : 'bg-coral-500/10 text-coral-600 dark:text-coral-400'}`}>
        {report.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        {report.count} étudiant{report.count > 1 ? 's' : ''} sur {report.expected} attendus, numéros {report.firstNo ?? '—'} à {report.lastNo ?? '—'}
        {report.ok ? '' : ` · ${report.errors} erreur${report.errors > 1 ? 's' : ''} à corriger`}
      </div>
      {report.anomalies.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {report.anomalies.map((a, i) => {
            const l = LEVELS[a.level]
            const Icon = l.icon
            return (
              <li key={i} className="flex gap-2">
                <Icon size={16} className={`mt-0.5 shrink-0 ${l.className}`} aria-label={l.label} />
                <span className="text-ink">{a.message}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Aucune anomalie.</p>
      )}
      <div className="rounded-xl border border-ink/8 p-3 text-sm text-ink">
        <p>
          <b>{plan.added.length}</b> à ajouter · <b>{plan.kept.length}</b> conservés avec leur identifiant et leur historique · <b>{plan.archived.length}</b> retirés de la liste (archivés, jamais supprimés)
        </p>
        {plan.kept.some((k) => k.renamed) && (
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">Orthographes mises à jour</summary>
            <ul className="mt-1 text-xs text-ink-soft">
              {plan.kept
                .filter((k) => k.renamed)
                .map((k) => (
                  <li key={k.id}>
                    {k.oldName} → {k.name}
                  </li>
                ))}
            </ul>
          </details>
        )}
        {plan.archived.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">Étudiants retirés de la liste</summary>
            <ul className="mt-1 text-xs text-ink-soft">
              {plan.archived.map((a) => (
                <li key={a.id}>{a.name}</li>
              ))}
            </ul>
          </details>
        )}
        {plan.toReconcile.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-400/10 p-2.5 text-xs">
            <p className="font-semibold">Peut-être la même personne sous une autre orthographe. Rien n’est fusionné : si c’est le cas, corrigez d’abord le nom de l’ancien étudiant dans sa fiche, puis relancez la vérification.</p>
            <ul className="mt-1">
              {plan.toReconcile.map((r) => (
                <li key={`${r.no}-${r.oldId}`}>
                  n° {r.no} {r.name} / ancien : {r.oldName} ({r.why})
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">Voir la liste lue</summary>
          <ol className="mt-1 max-h-60 overflow-y-auto text-xs text-ink-soft">
            {entries.map((e, i) => (
              <li key={i}>
                {e.no ?? '—'}. {e.name}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  )
}

function RosterImport() {
  const { cls, reload } = useCampus()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [expected, setExpected] = useState(String(cls.expected))
  const [preview, setPreview] = useState(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)
  const [imports, setImports] = useState(null)
  const fileRef = useRef(null)

  const loadImports = useCallback(() => {
    fetchImports(cls.id)
      .then(setImports)
      .catch(() => setImports([]))
  }, [cls.id])
  useEffect(() => loadImports(), [loadImports])

  const change = (value) => {
    setText(value)
    setPreview(null)
    setResult(null)
    setChecked(false)
  }

  async function check() {
    setBusy('check')
    setResult(null)
    try {
      setPreview(await previewImport(cls.id, { text, expected: Number(expected) }))
      setChecked(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  async function go() {
    setBusy('import')
    try {
      const done = await runImport(cls.id, { text, expected: Number(expected), hash: preview.hash, confirmed: true })
      setResult(done)
      setPreview(null)
      setText('')
      showToast('Liste officielle importée.', 'success')
      loadImports()
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
      if (err.status === 409) setPreview(null)
    } finally {
      setBusy('')
    }
  }

  async function readFile(file) {
    if (!file) return
    change((await file.text()).replace(/^\ufeff/, ''))
    fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <Panel title={`Liste officielle · ${cls.code}`}>
        <p className="mb-3 text-sm text-ink-soft">
          Une ligne par étudiant : « 1. NOM Prénom ». Le numéro sert de référence d’importation, pas de matricule. La liste est d’abord contrôlée ; rien n’est enregistré avant votre validation, et aucun statut de présence n’est attribué.
        </p>
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => change(e.target.value)}
            rows={10}
            placeholder={'1. NOM Prénom\n2. NOM Prénom\n…'}
            aria-label="Liste des étudiants"
            className="w-full rounded-xl border border-ink/12 bg-surface p-3 font-mono text-xs text-ink outline-none focus:border-violet-400"
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <Field label="Effectif officiel">
                <input
                  type="number"
                  min="1"
                  max="400"
                  className={fieldClass}
                  value={expected}
                  onChange={(e) => {
                    setExpected(e.target.value)
                    setPreview(null)
                  }}
                />
              </Field>
            </div>
            <Btn icon={FileUp} onClick={() => fileRef.current?.click()} className="h-11">
              Fichier texte
            </Btn>
            <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            <Btn variant="primary" busy={busy === 'check'} disabled={!text.trim() || !expected} onClick={check} className="h-11">
              Vérifier la liste
            </Btn>
          </div>
        </div>
        {preview && (
          <div className="mt-4 border-t border-ink/8 pt-4">
            <ReportView preview={preview} />
            {preview.report.ok && (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                  J’ai lu le rapport. Cette liste devient la liste officielle de la classe {cls.code}.
                </label>
                <Btn variant="primary" busy={busy === 'import'} disabled={!checked} onClick={go}>
                  Importer les {preview.report.count} étudiants
                </Btn>
              </div>
            )}
          </div>
        )}
        {result && (
          <div role="status" className="mt-4 rounded-xl bg-mint-500/10 px-3.5 py-3 text-sm text-ink">
            <b>{result.active} étudiants</b> sur la liste officielle ({result.added} ajoutés, {result.kept} conservés, {result.archived} archivés). {result.uniqueIds} identifiants uniques, numérotation {result.numbersOk ? 'complète' : 'incomplète'}.
          </div>
        )}
      </Panel>
      <Panel title="Importations précédentes">
        {!imports ? (
          <Loading />
        ) : imports.length ? (
          <ul className="divide-y divide-ink/8 text-sm">
            {imports.map((i) => (
              <li key={i.id} className="py-3">
                <p className="font-semibold text-ink">
                  Version {i.version} : {i.count} étudiants
                </p>
                <p className="text-ink-soft">
                  {i.added} ajoutés, {i.kept} conservés, {i.archived.length} archivés, {i.anomalies.length} remarque{i.anomalies.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-ink-soft">
                  {i.by} · {dateTime(i.at)}
                </p>
                {i.anomalies.length > 0 && (
                  <details className="mt-1 text-xs text-ink-soft">
                    <summary className="cursor-pointer font-semibold">Rapport d’anomalies</summary>
                    <ul className="mt-1">
                      {i.anomalies.map((a, k) => (
                        <li key={k}>
                          {LEVELS[a.level]?.label} : {a.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune importation.</Empty>
        )}
      </Panel>
    </div>
  )
}

function Catalog({ kind, title, list, addLabel }) {
  const { reload } = useCampus()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function act(action, message) {
    setBusy(true)
    try {
      await action()
      await reload()
      showToast(message, 'success')
      return true
    } catch (err) {
      showToast(err.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel title={title}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await act(() => addNamed(kind, name.trim()), 'Ajouté.')) setName('')
        }}
      >
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={addLabel} aria-label={addLabel} required minLength={2} maxLength={100} />
        <Btn variant="primary" type="submit" busy={busy}>
          Ajouter
        </Btn>
      </form>
      {list.length ? (
        <ul className="divide-y divide-ink/8">
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
              {editing?.id === x.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (await act(() => renameNamed(kind, x.id, editing.name.trim()), 'Renommé partout : catalogue, feuilles et plannings.')) setEditing(null)
                  }}
                >
                  <input className={fieldClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Nom" required minLength={2} maxLength={100} />
                  <Btn type="submit" busy={busy}>
                    OK
                  </Btn>
                </form>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${x.active ? 'text-ink' : 'text-ink-soft line-through'}`}>{x.name}</span>
                  <Btn variant="ghost" onClick={() => setEditing({ id: x.id, name: x.name })}>
                    Renommer
                  </Btn>
                  <Btn variant="ghost" disabled={busy} onClick={() => act(() => updateNamed(kind, x.id, { active: !x.active }), x.active ? 'Retiré des choix.' : 'De nouveau proposé.')}>
                    {x.active ? 'Masquer' : 'Remettre'}
                  </Btn>
                  <Btn variant="ghost" icon={Trash2} aria-label={`Supprimer ${x.name}`} className="!text-coral-600 dark:!text-coral-400" onClick={() => setDeleting(x)} />
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Rien pour l’instant.</Empty>
      )}
      {deleting && (
        <DeleteNamedDialog
          what={kind}
          item={deleting}
          others={list.filter((x) => x.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDelete={async (body) => {
            const r = await deleteNamed(kind, deleting.id, body)
            await reload()
            showToast(r.replacedBy ? `Supprimé, remplacé par ${r.replacedBy}.` : 'Supprimé.', 'success')
            setDeleting(null)
          }}
        />
      )}
    </Panel>
  )
}

function MemberDialog({ member, onClose, onSaved }) {
  const { boot } = useCampus()
  const { showToast } = useToast()
  const [form, setForm] = useState(member ? { email: member.email, name: member.name, role: member.role, teacherId: member.teacherId || '', canExport: member.canExport, canPermit: member.canPermit } : { email: '', name: '', role: 'agent', teacherId: '', canExport: true, canPermit: false })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const roles = boot.me.appAdmin ? ['agent', 'teacher', 'admin'] : ['agent', 'teacher']

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await setMember({ ...form, teacherId: form.teacherId || null })
      showToast(member ? 'Accès modifié.' : 'Accès accordé.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={member ? 'Modifier un accès' : 'Donner un accès'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-member" busy={busy}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form id="campus-member" onSubmit={submit} className="space-y-3">
        <Field label="Adresse e-mail du compte BomaVibes" hint="La personne doit déjà avoir un compte et avoir vérifié son adresse.">
          <input type="email" className={fieldClass} value={form.email} onChange={set('email')} readOnly={!!member} required />
        </Field>
        <Field label="Nom affiché sur les feuilles">
          <input className={fieldClass} value={form.name} onChange={set('name')} required minLength={2} maxLength={100} />
        </Field>
        <Field label="Rôle">
          <select className={fieldClass} value={form.role} onChange={set('role')}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        {form.role === 'teacher' && (
          <Field label="Enseignant correspondant" hint="Ce compte ne verra que les séances de cet enseignant.">
            <select className={fieldClass} value={form.teacherId} onChange={set('teacherId')} required>
              <option value="">Choisir</option>
              {boot.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {form.role === 'agent' && (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={form.canPermit} onChange={set('canPermit')} />
            <span>Accorde les permissions et justifie les absences (chargé·e pédagogique)</span>
          </label>
        )}
        {form.role !== 'admin' && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={form.canExport} onChange={set('canExport')} />
            Peut exporter et imprimer (PDF, Excel)
          </label>
        )}
      </form>
    </Dialog>
  )
}

function Members() {
  const { boot } = useCampus()
  const { showToast } = useToast()
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setError('')
    fetchMembers()
      .then(setMembers)
      .catch((err) => setError(err.message))
  }, [])
  useEffect(() => load(), [load])

  async function remove() {
    setBusy(true)
    try {
      await removeMember(removing.uid)
      showToast('Accès retiré.', 'success')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }
  return (
    <Panel
      title="Utilisateurs"
      action={
        <Btn variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
          Donner un accès
        </Btn>
      }
    >
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!members && !error && <Loading />}
      {members &&
        (members.length ? (
          <ul className="divide-y divide-ink/8">
            {members.map((m) => (
              <li key={m.uid} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{m.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {m.role === 'agent' && m.canPermit ? 'Chargé·e pédagogique' : ROLE_LABELS[m.role]}
                    {m.role === 'teacher' && ` (${boot.teachers.find((t) => t.id === m.teacherId)?.name || 'enseignant inconnu'})`} · {m.email}
                    {m.role !== 'admin' && (m.canExport ? ' · export autorisé' : ' · sans export')}
                  </span>
                </span>
                <span className="flex gap-1">
                  {(boot.me.appAdmin || m.role !== 'admin') && (
                    <Btn variant="ghost" icon={Pencil} onClick={() => setAdding(m)}>
                      Modifier
                    </Btn>
                  )}
                  <Btn variant="ghost" icon={Trash2} className="!text-coral-600 dark:!text-coral-400" onClick={() => setRemoving(m)}>
                    Retirer l’accès
                  </Btn>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun agent ni enseignant pour l’instant. Les administrateurs BomaVibes ont déjà accès.</Empty>
        ))}
      {adding && (
        <MemberDialog
          member={adding === true ? null : adding}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            load()
          }}
        />
      )}
      {removing && <ConfirmModal title={`Retirer l’accès de ${removing.name} ?`} description="Les feuilles saisies par cette personne restent inchangées." confirmLabel="Retirer" isConfirming={busy} onCancel={() => setRemoving(null)} onConfirm={remove} />}
    </Panel>
  )
}

function Log() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    fetchAudit()
      .then(setEntries)
      .catch((err) => setError(err.message))
  }, [])
  useEffect(() => load(), [load])
  return (
    <Panel title="Journal des modifications" action={<span className="text-xs text-ink-soft">300 derniers événements</span>}>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!entries && !error && <Loading />}
      {entries && <AuditList entries={entries} />}
    </Panel>
  )
}

function ClassDialog({ cls, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(cls ? { code: cls.code, label: cls.label, expected: String(cls.expected) } : { code: '', label: '', expected: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const body = { code: form.code.trim(), label: form.label.trim(), expected: Number(form.expected) }
    try {
      await (cls ? updateClass(cls.id, body) : createClass(body))
      showToast(cls ? 'Classe modifiée.' : 'Classe créée : importez sa liste.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message, 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={cls ? 'Modifier la classe' : 'Nouvelle classe'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" type="submit" form="campus-class" busy={busy}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form id="campus-class" onSubmit={submit} className="space-y-3">
        <Field label="Code (affiché partout)">
          <input className={fieldClass} value={form.code} onChange={set('code')} required maxLength={20} placeholder="L2" />
        </Field>
        <Field label="Intitulé">
          <input className={fieldClass} value={form.label} onChange={set('label')} required maxLength={60} placeholder="Licence 2" />
        </Field>
        <Field label="Effectif officiel">
          <input type="number" min="1" max="400" className={fieldClass} value={form.expected} onChange={set('expected')} required />
        </Field>
      </form>
    </Dialog>
  )
}

function Classes() {
  const { boot, cls, setClassId, reload } = useCampus()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  return (
    <Panel
      title="Classes"
      action={
        <Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>
          Nouvelle classe
        </Btn>
      }
    >
      <ul className="divide-y divide-ink/8">
        {boot.classes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              <span className="block text-sm font-semibold text-ink">
                {c.code} · {c.label}
              </span>
              <span className="block text-xs text-ink-soft">
                Effectif officiel : {c.expected}
                {c.rosterVersion ? '' : ' · liste à importer'}
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {cls?.id !== c.id && (
                <Btn variant="ghost" onClick={() => setClassId(c.id)}>
                  Ouvrir
                </Btn>
              )}
              <Btn variant="ghost" icon={Pencil} onClick={() => setEditing(c)}>
                Modifier
              </Btn>
              <Btn variant="ghost" icon={Trash2} className="!text-coral-600 dark:!text-coral-400" onClick={() => setDeleting(c)}>
                Supprimer
              </Btn>
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <ClassDialog
          cls={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload().catch(() => {})
          }}
        />
      )}
      {deleting && (
        <ReasonDialog
          title={`Supprimer la classe ${deleting.code} ?`}
          text="La classe et ses étudiants vont dans la corbeille. Ses feuilles et ses plannings doivent être supprimés avant."
          confirm="Supprimer la classe"
          typed
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await deleteClass(deleting.id, reason)
            setDeleting(null)
            showToast('Classe mise à la corbeille.', 'success')
            await reload()
          }}
        />
      )}
    </Panel>
  )
}

function Trash() {
  const { reload } = useCampus()
  const { showToast } = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [purging, setPurging] = useState(null)
  const [busy, setBusy] = useState('')
  const load = useCallback(() => {
    setError('')
    fetchTrash()
      .then(setItems)
      .catch((err) => setError(err.message))
  }, [])
  useEffect(() => load(), [load])

  async function act(id, action, message) {
    setBusy(id)
    try {
      await action()
      showToast(message, 'success')
      load()
      reload().catch(() => {})
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy('')
      setPurging(null)
    }
  }
  return (
    <Panel title="Corbeille">
      <p className="mb-3 text-sm text-ink-soft">Ce que l’administrateur a supprimé. Restaurer remet l’élément exactement comme il était. Le journal, lui, ne s’efface jamais.</p>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!items && !error && <Loading />}
      {items &&
        (items.length ? (
          <ul className="divide-y divide-ink/8">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{t.label}</span>
                  <span className="block text-xs text-ink-soft">
                    {TRASH_LABELS[t.type]} · {t.by}, {dateTime(t.at)} · Motif : {t.reason}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  <Btn icon={RotateCcw} busy={busy === t.id && !purging} onClick={() => act(t.id, () => restoreTrash(t.id), 'Restauré.')}>
                    Restaurer
                  </Btn>
                  <Btn variant="ghost" icon={Trash2} className="!text-coral-600 dark:!text-coral-400" onClick={() => setPurging(t)}>
                    Effacer
                  </Btn>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>La corbeille est vide.</Empty>
        ))}
      {purging && <ConfirmModal title="Effacer définitivement ?" description={`« ${purging.label} » ne pourra plus être restauré.`} confirmLabel="Effacer" confirmingLabel="Effacement…" isConfirming={busy === purging.id} onCancel={() => setPurging(null)} onConfirm={() => act(purging.id, () => purgeTrash(purging.id), 'Effacé définitivement.')} />}
    </Panel>
  )
}

const TABS = [
  ['liste', 'Liste officielle'],
  ['classes', 'Classes'],
  ['catalogue', 'Matières et enseignants'],
  ['utilisateurs', 'Utilisateurs'],
  ['corbeille', 'Corbeille'],
  ['journal', 'Journal'],
]

function AdminPanel() {
  const { boot, cls } = useCampus()
  const [params, setParams] = useSearchParams()
  if (!boot.me.admin) return <Empty>Réservé à l’administrateur de l’établissement.</Empty>
  if (!cls) return <Empty>Créez d’abord la classe depuis le tableau de bord.</Empty>
  const tab = params.get('onglet') || 'liste'
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold text-ink">Administration</h1>
      <div className="flex gap-1.5 overflow-x-auto" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setParams({ onglet: key })} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold ${tab === key ? 'border-violet-950 bg-violet-950 text-white dark:border-violet-600 dark:bg-violet-600' : 'border-ink/12 bg-surface text-ink-soft'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'liste' && <RosterImport key={cls.id} />}
      {tab === 'catalogue' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Catalog kind="subjects" title="Matières" list={boot.subjects} addLabel="Nouvelle matière" />
          <Catalog kind="teachers" title="Enseignants" list={boot.teachers} addLabel="Nouvel enseignant" />
        </div>
      )}
      {tab === 'classes' && <Classes />}
      {tab === 'corbeille' && <Trash />}
      {tab === 'utilisateurs' && <Members />}
      {tab === 'journal' && <Log />}
    </div>
  )
}

export default AdminPanel
