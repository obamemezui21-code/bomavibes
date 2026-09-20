import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { fetchAdminReports, updateAdminReportStatus } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'

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

function AdminReports() {
  const { showToast } = useToast()
  const [status, setStatus] = useState('pending')
  const [reports, setReports] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

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
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-ink-soft/40">{formatDate(report.createdAt)}</p>
              {report.status === 'pending' && (
                <div className="flex gap-2">
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminReports
