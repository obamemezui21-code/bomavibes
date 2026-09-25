import { useCallback, useEffect, useState } from 'react'
import { Bell, Pencil, Send, Trash2 } from 'lucide-react'
import {
  deleteAdminAnnouncement,
  fetchAdminAnnouncement,
  fetchAdminLogs,
  sendAdminNotificationBroadcast,
  updateAdminAnnouncement,
} from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Modal from '../components/ui/Modal.jsx'
import Button from '../components/ui/Button.jsx'

const AUDIENCES = [
  { value: 'all', label: 'Tous les utilisateurs' },
  { value: 'verified', label: 'Utilisateurs vérifiés' },
  { value: 'new', label: 'Nouveaux utilisateurs (7 derniers jours)' },
  { value: 'inactive', label: 'Utilisateurs inactifs (30+ jours)' },
]

const EMPTY_FORM = { title: '', message: '', audience: 'all', publishAnnouncement: true, ctaLabel: '', ctaLink: '' }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function HistoryRow({ log, isDeleted, onEdit, onDelete }) {
  const meta = log.metadata || {}
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{meta.title || 'Sans titre'}</p>
        <span className="shrink-0 rounded-full bg-ink/6 px-2 py-0.5 text-[10px] font-bold text-ink-soft/60">
          {AUDIENCES.find((a) => a.value === meta.audience)?.label || meta.audience}
        </span>
      </div>
      <p className="text-sm text-ink-soft/70">{meta.message}</p>
      <p className="mt-1.5 text-xs text-ink-soft/50">
        {log.adminEmail} · {formatDate(log.createdAt)} · push envoyé à {meta.pushSent ?? 0}
        {meta.pushFailed ? ` (${meta.pushFailed} échec${meta.pushFailed > 1 ? 's' : ''})` : ''}
        {meta.publishAnnouncement ? ' · annonce publiée' : ''}
      </p>
      {meta.announcementId && isDeleted && (
        <p className="mt-2.5 border-t border-ink/6 pt-2.5 text-xs italic text-ink-soft/50">Annonce supprimée</p>
      )}
      {meta.announcementId && !isDeleted && (
        <div className="mt-2.5 flex gap-2 border-t border-ink/6 pt-2.5">
          <button
            type="button"
            onClick={() => onEdit(meta.announcementId)}
            className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-xs font-semibold text-ink-soft/70 transition hover:bg-violet-500/10 hover:text-violet-600"
          >
            <Pencil size={12} strokeWidth={2.25} />
            Modifier l’annonce
          </button>
          <button
            type="button"
            onClick={() => onDelete(meta.announcementId)}
            className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-xs font-semibold text-coral-600 transition hover:bg-coral-500/10"
          >
            <Trash2 size={12} strokeWidth={2.25} />
            Supprimer l’annonce
          </button>
        </div>
      )}
    </div>
  )
}

const EMPTY_EDIT_FORM = { title: '', description: '', ctaLabel: '', ctaLink: '' }

function AdminNotifications() {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [history, setHistory] = useState([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedIds, setDeletedIds] = useState(new Set())

  const loadHistory = useCallback(() => {
    setIsHistoryLoading(true)
    fetchAdminLogs({ action: 'SEND_NOTIFICATION' })
      .then((data) => setHistory(data.logs))
      .catch(() => showToast("Impossible de charger l'historique.", 'error'))
      .finally(() => setIsHistoryLoading(false))
  }, [showToast])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) return
    setIsConfirming(true)
  }

  async function handleConfirmSend() {
    setIsSending(true)
    try {
      const result = await sendAdminNotificationBroadcast({
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
        publishAnnouncement: form.publishAnnouncement,
        ctaLabel: form.ctaLabel.trim() || undefined,
        ctaLink: form.ctaLink.trim() || undefined,
      })
      showToast(`Envoyé — ${result.pushSent} notification(s) push délivrée(s).`, 'success')
      setForm(EMPTY_FORM)
      setIsConfirming(false)
      loadHistory()
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer la notification.", 'error')
    } finally {
      setIsSending(false)
    }
  }

  async function openEdit(announcementId) {
    setEditingId(announcementId)
    setIsLoadingEdit(true)
    try {
      const { item } = await fetchAdminAnnouncement(announcementId)
      setEditForm({
        title: item.title || '',
        description: item.description || '',
        ctaLabel: item.ctaLabel || '',
        ctaLink: item.ctaLink || '',
      })
    } catch (err) {
      showToast(err.message || "Impossible de charger l'annonce.", 'error')
      setEditingId(null)
    } finally {
      setIsLoadingEdit(false)
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm.title.trim() || !editForm.description.trim()) return
    setIsSavingEdit(true)
    try {
      await updateAdminAnnouncement(editingId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        ctaLabel: editForm.ctaLabel.trim() || undefined,
        ctaLink: editForm.ctaLink.trim() || undefined,
      })
      showToast('Annonce mise à jour.', 'success')
      setEditingId(null)
    } catch (err) {
      showToast(err.message || "Impossible de mettre à jour l'annonce.", 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await deleteAdminAnnouncement(deletingId)
      showToast('Annonce supprimée.', 'success')
      setDeletedIds((prev) => new Set(prev).add(deletingId))
      setDeletingId(null)
    } catch (err) {
      showToast(err.message || "Impossible de supprimer l'annonce.", 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 desktop:py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
          <Bell size={20} strokeWidth={2} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Notifications</h1>
          <p className="text-xs text-ink-soft/60">Push + annonce interne vers une audience</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel space-y-3 rounded-2xl p-4">
        <div>
          <label className={labelClass} htmlFor="notif-title">
            Titre
          </label>
          <input
            id="notif-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="notif-message">
            Message
          </label>
          <textarea
            id="notif-message"
            rows={4}
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="notif-audience">
            Audience
          </label>
          <select
            id="notif-audience"
            value={form.audience}
            onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
            className={inputClass}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-soft/50">
            Seuls les appareils avec notifications activées reçoivent le push. L'annonce interne (ci-dessous) reste
            visible pour tout le monde dans l'onglet Annonces, quelle que soit l'audience choisie ici.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="notif-cta-label">
              Bouton (optionnel)
            </label>
            <input
              id="notif-cta-label"
              type="text"
              value={form.ctaLabel}
              onChange={(e) => setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="notif-cta-link">
              Lien du bouton
            </label>
            <input
              id="notif-cta-link"
              type="text"
              value={form.ctaLink}
              onChange={(e) => setForm((prev) => ({ ...prev, ctaLink: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={form.publishAnnouncement}
            onChange={(e) => setForm((prev) => ({ ...prev, publishAnnouncement: e.target.checked }))}
            className="h-4 w-4 rounded border-ink/20"
          />
          Publier aussi comme annonce interne (onglet Annonces) + une publication dans le Feed
        </label>
        <Button type="submit" className="flex w-full items-center justify-center gap-2">
          <Send size={15} strokeWidth={2.25} />
          Envoyer
        </Button>
      </form>

      <h2 className="mb-3 mt-8 font-display text-base font-semibold text-ink">Historique</h2>
      {isHistoryLoading && <p className="py-6 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isHistoryLoading && history.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-soft/50">Aucune notification envoyée pour le moment.</p>
      )}
      <div className="space-y-2">
        {history.map((log) => (
          <HistoryRow
            key={log.id}
            log={log}
            isDeleted={deletedIds.has(log.metadata?.announcementId)}
            onEdit={openEdit}
            onDelete={setDeletingId}
          />
        ))}
      </div>

      {isConfirming && (
        <ConfirmModal
          title="Envoyer cette notification ?"
          description={`Elle sera poussée immédiatement à l'audience "${AUDIENCES.find((a) => a.value === form.audience)?.label}". Cette action est irréversible.`}
          confirmLabel="Envoyer"
          confirmingLabel="Envoi…"
          danger={false}
          isConfirming={isSending}
          onCancel={() => setIsConfirming(false)}
          onConfirm={handleConfirmSend}
        />
      )}

      {editingId && (
        <Modal onClose={() => setEditingId(null)} className="max-w-sm text-left">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Modifier l’annonce</h2>
          {isLoadingEdit ? (
            <p className="py-6 text-center text-sm text-ink-soft/50">Chargement…</p>
          ) : (
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="edit-title">
                  Titre
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-description">
                  Message
                </label>
                <textarea
                  id="edit-description"
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="edit-cta-label">
                    Bouton (optionnel)
                  </label>
                  <input
                    id="edit-cta-label"
                    type="text"
                    value={editForm.ctaLabel}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="edit-cta-link">
                    Lien du bouton
                  </label>
                  <input
                    id="edit-cta-link"
                    type="text"
                    value={editForm.ctaLink}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ctaLink: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-ink-soft/50">
                Le push déjà envoyé ne peut pas être modifié — ceci met à jour l’annonce dans l’onglet Annonces et le
                post correspondant dans le Feed.
              </p>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingId(null)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={isSavingEdit}>
                  {isSavingEdit ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {deletingId && (
        <ConfirmModal
          title="Supprimer cette annonce ?"
          description="Elle disparaîtra de l'onglet Annonces et du Feed. Le push déjà envoyé ne peut pas être rappelé."
          confirmLabel="Supprimer"
          confirmingLabel="Suppression…"
          danger
          isConfirming={isDeleting}
          onCancel={() => setDeletingId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default AdminNotifications
