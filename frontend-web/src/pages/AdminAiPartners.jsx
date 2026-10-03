import { useCallback, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Plus, Pencil, Trash2, Upload, Power, Sparkles } from 'lucide-react'
import {
  createAiPartner,
  deleteAiPartner,
  fetchAiPartners,
  fetchAiPartnersStats,
  updateAiPartner,
  uploadCmsMedia,
} from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import Modal from '../components/ui/Modal.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Button from '../components/ui/Button.jsx'

// Which page a partner appears on (backend aiPartnersController CATEGORIES).
const CATEGORIES = [
  { value: 'ia', label: 'Studio IA', page: '/studio-ia' },
  { value: 'streaming', label: 'Ciné & Séries', page: '/cine' },
]
const categoryLabel = (c) => CATEGORIES.find((x) => x.value === (c || 'ia'))?.label

const EMPTY_FORM = {
  categorie: 'ia',
  nom: '',
  description: '',
  idealPour: '',
  logoUrl: '',
  lienAffilie: '',
  prixAPartirDe: '',
  devise: 'USD',
  planGratuit: false,
  ordre: 0,
}

function toFormValues(item) {
  return {
    categorie: item.categorie || 'ia',
    nom: item.nom || '',
    description: item.description || '',
    idealPour: item.idealPour || '',
    logoUrl: item.logoUrl || '',
    lienAffilie: item.lienAffilie || '',
    prixAPartirDe: item.prixAPartirDe || '',
    devise: item.devise || 'USD',
    planGratuit: !!item.planGratuit,
    ordre: item.ordre || 0,
  }
}

function toPayload(form) {
  return {
    categorie: form.categorie,
    nom: form.nom.trim(),
    description: form.description.trim(),
    idealPour: form.idealPour.trim(),
    logoUrl: form.logoUrl.trim(),
    lienAffilie: form.lienAffilie.trim(),
    prixAPartirDe: Number(form.prixAPartirDe) || 0,
    devise: form.devise.trim() || 'USD',
    planGratuit: !!form.planGratuit,
    ordre: Number(form.ordre) || 0,
  }
}

function formatVerifiedDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function AdminAiPartners() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [editingItem, setEditingItem] = useState(null) // null = closed, {} = new, item = editing
  const [form, setForm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [category, setCategory] = useState('ia')
  const logoInputRef = useRef(null)

  const load = useCallback(() => {
    setIsLoading(true)
    Promise.all([fetchAiPartners(), fetchAiPartnersStats().catch(() => ({ stats: {} }))])
      .then(([partnersData, statsData]) => {
        setItems(partnersData.items)
        setStats(statsData.stats || {})
      })
      .catch(() => showToast('Impossible de charger les partenaires.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  function openNew() {
    setEditingItem({})
    setForm({ ...EMPTY_FORM, categorie: category })
  }

  function openEdit(item) {
    setEditingItem(item)
    setForm(toFormValues(item))
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = toPayload(form)
      if (editingItem?.id) {
        const { item } = await updateAiPartner(editingItem.id, payload)
        setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)))
        showToast('Modifications enregistrées.', 'success')
      } else {
        const { item } = await createAiPartner({ ...payload, actif: true })
        setItems((prev) => [...prev, item])
        showToast('Plateforme ajoutée.', 'success')
      }
      setEditingItem(null)
      setForm(null)
    } catch (err) {
      showToast(err.message || "Impossible d'enregistrer.", 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(item) {
    setTogglingId(item.id)
    try {
      const { item: updated } = await updateAiPartner(item.id, { actif: !item.actif })
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
      showToast(updated.actif ? 'Plateforme activée.' : 'Plateforme désactivée.', 'success')
    } catch {
      showToast("Impossible de mettre à jour le statut.", 'error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete() {
    if (!deletingItem) return
    setIsDeleting(true)
    try {
      await deleteAiPartner(deletingItem.id)
      setItems((prev) => prev.filter((it) => it.id !== deletingItem.id))
      showToast('Plateforme supprimée.', 'success')
      setDeletingItem(null)
    } catch {
      showToast('Impossible de supprimer.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  function triggerLogoUpload() {
    logoInputRef.current?.click()
  }

  async function handleLogoFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setIsUploadingLogo(true)
    try {
      const { file } = await uploadCmsMedia(picked)
      setForm((prev) => ({ ...prev, logoUrl: file.url }))
      showToast('Logo envoyé.', 'success')
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer ce logo.", 'error')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
            <Sparkles size={20} strokeWidth={2} />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">Affiliation</h1>
        </div>
        <Button onClick={openNew} className="flex items-center gap-1.5 px-4">
          <Plus size={16} strokeWidth={2.5} />
          Nouveau
        </Button>
      </div>
      <p className="mb-4 text-xs text-ink-soft/60">
        Plateformes partenaires en affiliation — BomaVibes ne gère ni le paiement ni le service, seulement le lien.
        Studio IA : outils vidéo IA. Ciné &amp; Séries : plateformes de films et séries (Prime Video, Apple TV+, Canal+…).
      </p>
      <div className="mb-4 flex gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              category === c.value ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/60 hover:bg-ink/10'
            }`}
          >
            {c.label} ({items.filter((it) => (it.categorie || 'ia') === c.value).length})
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isLoading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucune plateforme pour le moment.</p>
      )}

      <div className="space-y-2">
        {items.filter((it) => (it.categorie || 'ia') === category).map((item) => {
          const s = stats[item.id] || { last7Days: 0, last30Days: 0, total: 0 }
          return (
            <div key={item.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink/6">
                    {item.logoUrl ? (
                      <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-ink-soft/30" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{item.nom}</p>
                    <p className="truncate text-xs text-ink-soft/50">
                      {categoryLabel(item.categorie)} · Ordre {item.ordre} · Prix vérifié le {formatVerifiedDate(item.prixVerifieLe)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    item.actif ? 'bg-mint-500/15 text-mint-600' : 'bg-ink/8 text-ink-soft/60'
                  }`}
                >
                  {item.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4 rounded-xl bg-ink/[0.03] px-3 py-2 text-xs text-ink-soft/70">
                <span>
                  <span className="font-semibold text-ink">{s.last7Days}</span> clics / 7j
                </span>
                <span>
                  <span className="font-semibold text-ink">{s.last30Days}</span> clics / 30j
                </span>
                <span>
                  <span className="font-semibold text-ink">{s.total}</span> clics au total
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-xs font-semibold text-ink-soft/70 transition hover:bg-violet-500/10 hover:text-violet-600"
                >
                  <Pencil size={12} strokeWidth={2.25} />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  disabled={togglingId === item.id}
                  className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-xs font-semibold text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
                >
                  <Power size={12} strokeWidth={2.25} />
                  {item.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingItem(item)}
                  className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-xs font-semibold text-coral-600 transition hover:bg-coral-500/10"
                >
                  <Trash2 size={12} strokeWidth={2.25} />
                  Supprimer
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editingItem !== null && form && (
        <Modal onClose={() => setEditingItem(null)} className="max-h-[85vh] max-w-lg overflow-y-auto text-left">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            {editingItem.id ? 'Modifier la plateforme' : 'Nouvelle plateforme'}
          </h2>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="ai-categorie">
                Rubrique
              </label>
              <select
                id="ai-categorie"
                value={form.categorie}
                onChange={(e) => setForm((prev) => ({ ...prev, categorie: e.target.value }))}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.page})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-nom">
                Nom *
              </label>
              <input
                id="ai-nom"
                type="text"
                required
                value={form.nom}
                onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-description">
                Description
              </label>
              <textarea
                id="ai-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-ideal">
                Idéal pour
              </label>
              <input
                id="ai-ideal"
                type="text"
                placeholder="Ex : animer une photo, avatars qui parlent"
                value={form.idealPour}
                onChange={(e) => setForm((prev) => ({ ...prev, idealPour: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-logo">
                Logo
              </label>
              <div className="flex items-start gap-2">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-ink/6 text-ink-soft/30">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <input
                    id="ai-logo"
                    type="text"
                    placeholder="URL du logo, ou téléverse un fichier"
                    value={form.logoUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={triggerLogoUpload}
                    disabled={isUploadingLogo}
                    className="flex items-center gap-1.5 rounded-full bg-ink/6 px-3 py-1.5 text-xs font-semibold text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
                  >
                    <Upload size={13} strokeWidth={2.25} />
                    {isUploadingLogo ? 'Envoi…' : 'Téléverser un logo'}
                  </button>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-lien">
                Lien affilié *
              </label>
              <input
                id="ai-lien"
                type="text"
                required
                placeholder="https://..."
                value={form.lienAffilie}
                onChange={(e) => setForm((prev) => ({ ...prev, lienAffilie: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="ai-prix">
                  Prix à partir de
                </label>
                <input
                  id="ai-prix"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0 = « Voir le prix »"
                  value={form.prixAPartirDe}
                  onChange={(e) => setForm((prev) => ({ ...prev, prixAPartirDe: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ai-devise">
                  Devise
                </label>
                <input
                  id="ai-devise"
                  type="text"
                  value={form.devise}
                  onChange={(e) => setForm((prev) => ({ ...prev, devise: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-ordre">
                Ordre d'affichage
              </label>
              <input
                id="ai-ordre"
                type="number"
                value={form.ordre}
                onChange={(e) => setForm((prev) => ({ ...prev, ordre: e.target.value }))}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/80">
              <input
                type="checkbox"
                checked={form.planGratuit}
                onChange={(e) => setForm((prev) => ({ ...prev, planGratuit: e.target.checked }))}
                className="h-4 w-4 rounded border-ink/20"
              />
              Plan gratuit disponible
            </label>
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
          title="Supprimer cette plateforme ?"
          description={`« ${deletingItem.nom} » ne sera plus visible dans l’app. Cette action est irréversible.`}
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

export default AdminAiPartners
