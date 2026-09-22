import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldX, Trash2, UserCheck, UserX } from 'lucide-react'
import { deleteAdminPost, fetchAdminReports, setAdminUserBanned, updateAdminReportStatus } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'

const STATUS_TABS = [
  { value: 'pending', label: 'En attente' },
  { value: 'actioned', label: 'Traités' },
  { value: 'dismissed', label: 'Rejetés' },
  { value: 'all', label: 'Tous' },
]

const STATUS_BADGES = {
  pending: 'bg-amber-500/15 text-amber-600',
  reviewed: 'bg-sky-500/15 text-sky-600',
  dismissed: 'bg-ink/8 text-ink-soft/60',
  actioned: 'bg-mint-500/15 text-mint-600',
}

const STATUS_LABELS = {
  pending: 'En attente',
  reviewed: 'Examiné',
  dismissed: 'Rejeté',
  actioned: 'Traité',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PostPreview({ post }) {
  if (post.deleted) {
    return <p className="mb-2 rounded-xl bg-ink/5 px-3 py-2 text-xs italic text-ink-soft/50">Publication déjà supprimée.</p>
  }
  return (
    <div className="mb-2 rounded-xl bg-ink/5 p-3">
      {post.photoUrl && (
        <img src={post.photoUrl} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" />
      )}
      {post.text && <p className="text-sm text-ink-soft/80">{post.text}</p>}
    </div>
  )
}

function AdminReports() {
  const { showToast } = useToast()
  const [status, setStatus] = useState('pending')
  const [reports, setReports] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchAdminReports(status)
      .then((data) => setReports(data.reports))
      .catch(() => showToast('Impossible de charger les signalements.', 'error'))
      .finally(() => setIsLoading(false))
  }, [status, showToast])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpdate(report, newStatus) {
    setUpdatingId(report.id)
    try {
      await updateAdminReportStatus(report.id, newStatus)
      showToast('Signalement mis à jour.', 'success')
      setReports((prev) =>
        status === 'all'
          ? prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r))
          : prev.filter((r) => r.id !== report.id),
      )
    } catch {
      showToast('Impossible de mettre à jour ce signalement.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return
    const { type, report } = confirmAction
    setIsConfirming(true)
    try {
      if (type === 'ban' || type === 'unban') {
        const banned = type === 'ban'
        await setAdminUserBanned(report.reportedUserId, banned)
        setReports((prev) =>
          prev.map((r) => (r.reportedUserId === report.reportedUserId ? { ...r, reportedUserBanned: banned } : r)),
        )
        showToast(banned ? 'Utilisateur banni.' : 'Utilisateur réactivé.', 'success')
      } else if (type === 'deletePost') {
        await deleteAdminPost(report.post.id)
        setReports((prev) =>
          prev.map((r) => (r.post?.id === report.post.id ? { ...r, post: { id: report.post.id, deleted: true } } : r)),
        )
        showToast('Publication supprimée.', 'success')
      }
      setConfirmAction(null)
    } catch {
      showToast("Impossible d'effectuer cette action.", 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Signalements</h2>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              status === tab.value ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/60 hover:bg-ink/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && reports.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucun signalement dans cette catégorie.</p>
      )}

      <div className="space-y-2">
        {reports.map((report) => (
          <div key={report.id} className="glass-panel rounded-2xl p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{report.reason}</p>
                <p className="truncate text-xs text-ink-soft/50">
                  {report.reporterEmail || report.reporterId} → {report.reportedUserEmail || report.reportedUserId}
                  {report.reportedUserBanned && (
                    <span className="ml-1.5 rounded-full bg-coral-500/15 px-1.5 py-0.5 text-[9px] font-bold text-coral-600">
                      BANNI
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  STATUS_BADGES[report.status] || STATUS_BADGES.pending
                }`}
              >
                {STATUS_LABELS[report.status] || report.status}
              </span>
            </div>
            {report.description && <p className="mb-2 text-sm text-ink-soft/70">{report.description}</p>}
            {report.post && <PostPreview post={report.post} />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-ink-soft/40">{formatDate(report.createdAt)}</p>
              <div className="flex flex-wrap gap-2">
                {report.post && !report.post.deleted && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'deletePost', report })}
                    className="flex items-center gap-1 rounded-full bg-ink/6 px-3 py-1.5 text-xs font-semibold text-ink-soft/70 transition hover:bg-coral-500/10 hover:text-coral-600"
                  >
                    <Trash2 size={13} strokeWidth={2.25} />
                    Supprimer la publication
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: report.reportedUserBanned ? 'unban' : 'ban', report })}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    report.reportedUserBanned
                      ? 'bg-ink/6 text-ink-soft/70 hover:bg-ink/10'
                      : 'bg-coral-500/10 text-coral-600 hover:bg-coral-500/20'
                  }`}
                >
                  {report.reportedUserBanned ? (
                    <>
                      <UserCheck size={13} strokeWidth={2.25} />
                      Débannir
                    </>
                  ) : (
                    <>
                      <UserX size={13} strokeWidth={2.25} />
                      Bannir
                    </>
                  )}
                </button>
                {report.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdate(report, 'dismissed')}
                      disabled={updatingId === report.id}
                      className="flex items-center gap-1 rounded-full bg-ink/6 px-3 py-1.5 text-xs font-semibold text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
                    >
                      <ShieldX size={13} strokeWidth={2.25} />
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(report, 'actioned')}
                      disabled={updatingId === report.id}
                      className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/25 transition disabled:opacity-50"
                    >
                      <ShieldCheck size={13} strokeWidth={2.25} />
                      Traiter
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'deletePost'
              ? 'Supprimer cette publication ?'
              : confirmAction.type === 'ban'
                ? 'Bannir cet utilisateur ?'
                : 'Réactiver cet utilisateur ?'
          }
          description={
            confirmAction.type === 'deletePost'
              ? 'La publication et ses commentaires seront définitivement supprimés.'
              : confirmAction.type === 'ban'
                ? `${confirmAction.report.reportedUserEmail || confirmAction.report.reportedUserId} ne pourra plus se connecter à BomaVibes.`
                : `${confirmAction.report.reportedUserEmail || confirmAction.report.reportedUserId} pourra de nouveau se connecter.`
          }
          confirmLabel={confirmAction.type === 'unban' ? 'Réactiver' : confirmAction.type === 'ban' ? 'Bannir' : 'Supprimer'}
          confirmingLabel="Un instant…"
          danger={confirmAction.type !== 'unban'}
          isConfirming={isConfirming}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  )
}

export default AdminReports
