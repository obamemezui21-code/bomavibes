import { useCallback, useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { fetchAdminLogs } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'

const ACTION_LABELS = {
  UPDATE_REPORT_STATUS: 'Signalement mis à jour',
  DELETE_POST: 'Publication supprimée',
  BAN_USER: 'Utilisateur banni',
  UNBAN_USER: 'Utilisateur réactivé',
  UPDATE_USER_ROLE: 'Rôle modifié',
  DELETE_USER_ACCOUNT: 'Compte supprimé',
  CREATE_CONTENT: 'Contenu créé',
  UPDATE_CONTENT: 'Contenu modifié',
  DELETE_CONTENT: 'Contenu supprimé',
  SEND_NOTIFICATION: 'Notification envoyée',
}

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

function LogRow({ log }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{ACTION_LABELS[log.action] || log.action}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            log.result === 'SUCCESS' ? 'bg-mint-500/15 text-mint-600' : 'bg-coral-500/15 text-coral-600'
          }`}
        >
          {log.result}
        </span>
      </div>
      <p className="text-xs text-ink-soft/50">
        {log.adminEmail || log.adminUid} · {formatDate(log.createdAt)}
      </p>
      {log.targetId && (
        <p className="mt-1 text-xs text-ink-soft/60">
          Cible : {log.targetType || 'inconnu'} <span className="font-mono">{log.targetId}</span>
        </p>
      )}
      {log.metadata && (
        <p className="mt-1 truncate text-xs text-ink-soft/40">{JSON.stringify(log.metadata)}</p>
      )}
    </div>
  )
}

function AdminLogs() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchAdminLogs()
      .then((data) => {
        setLogs(data.logs)
        setNextCursor(data.nextCursor)
      })
      .catch(() => showToast("Impossible de charger le journal d'activité.", 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function handleLoadMore() {
    setIsLoadingMore(true)
    try {
      const data = await fetchAdminLogs({ cursor: nextCursor })
      setLogs((prev) => [...prev, ...data.logs])
      setNextCursor(data.nextCursor)
    } catch {
      showToast('Impossible de charger la suite.', 'error')
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
          <ClipboardList size={20} strokeWidth={2} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Journal d'activité</h1>
          <p className="text-xs text-ink-soft/60">Actions de modération et d'administration récentes</p>
        </div>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && logs.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucune action enregistrée pour le moment.</p>
      )}

      <div className="space-y-2">
        {logs.map((log) => (
          <LogRow key={log.id} log={log} />
        ))}
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="mt-4 w-full rounded-xl bg-ink/6 py-2.5 text-sm font-semibold text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
        >
          {isLoadingMore ? 'Chargement…' : 'Charger plus'}
        </button>
      )}
    </div>
  )
}

export default AdminLogs
