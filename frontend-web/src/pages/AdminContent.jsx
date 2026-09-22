import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Calendar, FileText, HelpCircle, Image as ImageIcon, Newspaper, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import {
  createAdminContentItem,
  deleteAdminContentItem,
  fetchAdminContentList,
  updateAdminContentItem,
  uploadCmsMedia,
} from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import Modal from '../components/ui/Modal.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Button from '../components/ui/Button.jsx'

// Mirrors backend/src/services/contentService.js's CONTENT_TYPES — the
// backend is the source of truth for validation, this only drives the form.
const CONTENT_TYPE_CONFIG = {
  pages: {
    label: 'Pages',
    singular: 'une page',
    icon: FileText,
    hasSlug: true,
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true },
      { key: 'summary', label: 'Résumé', kind: 'textarea' },
      { key: 'content', label: 'Contenu', kind: 'textarea', rows: 10 },
      { key: 'image', label: 'Image', kind: 'image' },
    ],
  },
  articles: {
    label: 'Articles',
    singular: 'un article',
    icon: Newspaper,
    hasSlug: true,
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true },
      { key: 'summary', label: 'Résumé', kind: 'textarea' },
      { key: 'content', label: 'Contenu', kind: 'textarea', rows: 10 },
      { key: 'image', label: 'Image', kind: 'image' },
      { key: 'category', label: 'Catégorie', kind: 'text' },
      { key: 'tags', label: 'Tags (séparés par une virgule)', kind: 'tags' },
      { key: 'seoTitle', label: 'Titre SEO', kind: 'text' },
      { key: 'seoDescription', label: 'Description SEO', kind: 'textarea' },
    ],
  },
  faqs: {
    label: 'FAQ',
    singular: 'une question',
    icon: HelpCircle,
    hasSlug: false,
    fields: [
      { key: 'question', label: 'Question', kind: 'text', required: true },
      { key: 'answer', label: 'Réponse', kind: 'textarea', rows: 6, required: true },
      { key: 'category', label: 'Catégorie', kind: 'text' },
      { key: 'order', label: 'Ordre d’affichage', kind: 'number' },
    ],
  },
  banners: {
    label: 'Bannières',
    singular: 'une bannière',
    icon: ImageIcon,
    hasSlug: false,
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'image', label: 'Image', kind: 'image' },
      { key: 'buttonLabel', label: 'Texte du bouton', kind: 'text' },
      { key: 'buttonUrl', label: 'Lien du bouton', kind: 'text' },
      { key: 'position', label: 'Emplacement', kind: 'text' },
      { key: 'startDate', label: 'Date de début', kind: 'date' },
      { key: 'endDate', label: 'Date de fin', kind: 'date' },
    ],
  },
  events: {
    label: 'Événements',
    singular: 'un événement',
    icon: Calendar,
    hasSlug: false,
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true },
      { key: 'description', label: 'Description', kind: 'textarea', rows: 6 },
      {
        key: 'category',
        label: 'Catégorie',
        kind: 'select',
        options: ['Soirée', 'Concert', 'Conférence', 'Sport', 'Culture', 'Networking'],
      },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'location', label: 'Lieu', kind: 'text' },
      { key: 'organizer', label: 'Organisateur', kind: 'text' },
      { key: 'image', label: 'Image', kind: 'image' },
      { key: 'price', label: 'Prix affiché (ex : Gratuit, 2 000 FCFA)', kind: 'text' },
      { key: 'capacity', label: 'Capacité (0 = illimitée)', kind: 'number' },
    ],
  },
}

const STATUS_TABS = [
  { value: 'all', label: 'Tous' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'published', label: 'Publié' },
  { value: 'archived', label: 'Archivé' },
]

const STATUS_BADGES = {
  draft: 'bg-ink/8 text-ink-soft/60',
  published: 'bg-mint-500/15 text-mint-600',
  archived: 'bg-amber-500/15 text-amber-600',
}

const STATUS_LABELS = { draft: 'Brouillon', published: 'Publié', archived: 'Archivé' }

function emptyForm(config) {
  const form = { status: 'draft' }
  for (const field of config.fields) {
    form[field.key] = field.kind === 'number' ? 0 : ''
  }
  return form
}

function toFormValues(config, item) {
  const form = { status: item.status || 'draft' }
  for (const field of config.fields) {
    const value = item[field.key]
    if (field.kind === 'tags') form[field.key] = Array.isArray(value) ? value.join(', ') : ''
    else if (field.kind === 'number') form[field.key] = value ?? 0
    else form[field.key] = value ?? ''
  }
  return form
}

function toPayload(config, form) {
  const payload = { status: form.status }
  for (const field of config.fields) {
    const raw = form[field.key]
    if (field.kind === 'tags') {
      payload[field.key] = raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (field.kind === 'number') {
      payload[field.key] = Number(raw) || 0
    } else {
      payload[field.key] = raw
    }
  }
  return payload
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AdminContent() {
  const { type } = useParams()
  const config = CONTENT_TYPE_CONFIG[type]
  const { showToast } = useToast()

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingItem, setEditingItem] = useState(null) // null = closed, {} = new, item = editing
  const [form, setForm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploadingField, setUploadingField] = useState(null)
  const imageInputRef = useRef(null)

  const load = useCallback(() => {
    if (!config) return
    setIsLoading(true)
    fetchAdminContentList(type, statusFilter)
      .then((data) => setItems(data.items))
      .catch(() => showToast('Impossible de charger le contenu.', 'error'))
      .finally(() => setIsLoading(false))
  }, [type, statusFilter, config, showToast])

  useEffect(() => {
    load()
  }, [load])

  const titleField = useMemo(() => (config?.hasSlug ? 'title' : config?.fields[0]?.key), [config])

  if (!config) return <Navigate to="/admin" replace />

  function openNew() {
    setEditingItem({})
    setForm(emptyForm(config))
  }

  function openEdit(item) {
    setEditingItem(item)
    setForm(toFormValues(config, item))
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = toPayload(config, form)
      if (editingItem?.id) {
        const { item } = await updateAdminContentItem(type, editingItem.id, payload)
        setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)))
        showToast('Modifications enregistrées.', 'success')
      } else {
        const { item } = await createAdminContentItem(type, payload)
        setItems((prev) => [item, ...prev])
        showToast('Créé avec succès.', 'success')
      }
      setEditingItem(null)
      setForm(null)
    } catch (err) {
      showToast(err.message || 'Impossible d’enregistrer.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function triggerImageUpload(fieldKey) {
    setUploadingField(fieldKey)
    imageInputRef.current?.click()
  }

  async function handleImageFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    const fieldKey = uploadingField
    if (!picked || !fieldKey) return
    try {
      const { file } = await uploadCmsMedia(picked)
      setForm((prev) => ({ ...prev, [fieldKey]: file.url }))
      showToast('Image envoyée.', 'success')
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer cette image.", 'error')
    } finally {
      setUploadingField(null)
    }
  }

  async function handleDelete() {
    if (!deletingItem) return
    setIsDeleting(true)
    try {
      await deleteAdminContentItem(type, deletingItem.id)
      setItems((prev) => prev.filter((it) => it.id !== deletingItem.id))
      showToast('Supprimé.', 'success')
      setDeletingItem(null)
    } catch {
      showToast('Impossible de supprimer.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
            <config.icon size={20} strokeWidth={2} />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">{config.label}</h1>
        </div>
        <Button onClick={openNew} className="flex items-center gap-1.5 px-4">
          <Plus size={16} strokeWidth={2.5} />
          Nouveau
        </Button>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === tab.value ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/60 hover:bg-ink/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isLoading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Rien ici pour le moment.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="glass-panel flex items-start justify-between gap-3 rounded-2xl p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{item[titleField] || 'Sans titre'}</p>
              {config.hasSlug && item.slug && <p className="truncate text-xs text-ink-soft/40">/{item.slug}</p>}
              <p className="mt-1 text-xs text-ink-soft/50">Modifié le {formatDate(item.updatedAt)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_BADGES[item.status] || STATUS_BADGES.draft}`}>
              {STATUS_LABELS[item.status] || item.status}
            </span>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/8"
                aria-label="Modifier"
              >
                <Pencil size={14} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingItem(item)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-coral-500 transition hover:bg-coral-500/10"
                aria-label="Supprimer"
              >
                <Trash2 size={14} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingItem !== null && form && (
        <Modal onClose={() => setEditingItem(null)} className="max-w-lg max-h-[85vh] overflow-y-auto text-left">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            {editingItem.id ? `Modifier ${config.singular}` : `Nouveau — ${config.singular}`}
          </h2>
          <form onSubmit={handleSave} className="space-y-3">
            {config.fields.map((field) => (
              <div key={field.key}>
                <label className={labelClass} htmlFor={field.key}>
                  {field.label}
                  {field.required && ' *'}
                </label>
                {field.kind === 'textarea' ? (
                  <textarea
                    id={field.key}
                    rows={field.rows || 4}
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    required={field.required}
                    className={inputClass}
                  />
                ) : field.kind === 'image' ? (
                  <div className="flex items-start gap-2">
                    {form[field.key] ? (
                      <img src={form[field.key]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-ink/6 text-ink-soft/30">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5">
                      <input
                        id={field.key}
                        type="text"
                        placeholder="URL de l'image, ou téléverse un fichier"
                        value={form[field.key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => triggerImageUpload(field.key)}
                        disabled={uploadingField === field.key}
                        className="flex items-center gap-1.5 rounded-full bg-ink/6 px-3 py-1.5 text-xs font-semibold text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
                      >
                        <Upload size={13} strokeWidth={2.25} />
                        {uploadingField === field.key ? 'Envoi…' : 'Téléverser une image'}
                      </button>
                    </div>
                  </div>
                ) : field.kind === 'select' ? (
                  <select
                    id={field.key}
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    required={field.required}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.key}
                    type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    required={field.required}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
            <div>
              <label className={labelClass} htmlFor="status">
                Statut
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className={inputClass}
              >
                <option value="draft">Brouillon</option>
                <option value="published">Publié</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingItem(null)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deletingItem && (
        <ConfirmModal
          title={`Supprimer ${config.singular} ?`}
          description="Cette action est irréversible."
          confirmLabel="Supprimer"
          confirmingLabel="Suppression…"
          isConfirming={isDeleting}
          onCancel={() => setDeletingItem(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

export default AdminContent
