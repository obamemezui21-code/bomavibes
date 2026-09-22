import { useCallback, useEffect, useState } from 'react'
import { Bell, Send } from 'lucide-react'
import { fetchAdminLogs, sendAdminNotificationBroadcast } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
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

function HistoryRow({ log }) {
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
    </div>
  )
}

function AdminNotifications() {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [history, setHistory] = useState([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

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
          Publier aussi comme annonce interne (onglet Annonces)
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
          <HistoryRow key={log.id} log={log} />
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
    </div>
  )
}

export default AdminNotifications
