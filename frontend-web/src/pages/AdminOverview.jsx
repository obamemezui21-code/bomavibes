import { useEffect, useState } from 'react'
import { Heart, MessageSquareWarning, Newspaper, Users } from 'lucide-react'
import { fetchAdminStats } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'

const CARDS = [
  { key: 'totalUsers', label: 'Utilisateurs', icon: Users, color: 'from-violet-500 to-indigo-500' },
  { key: 'totalMatches', label: 'Matchs', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { key: 'totalPosts', label: 'Publications', icon: Newspaper, color: 'from-sky-500 to-cyan-500' },
  { key: 'pendingReports', label: 'Signalements en attente', icon: MessageSquareWarning, color: 'from-amber-500 to-orange-500' },
]

function AdminOverview() {
  const { showToast } = useToast()
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchAdminStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) showToast('Impossible de charger les statistiques.', 'error')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Vue d'ensemble</h2>
      <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        {CARDS.map((card) => (
          <div key={card.key} className="glass-panel rounded-2xl p-4">
            <span
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${card.color} text-white shadow-md`}
            >
              <card.icon size={16} strokeWidth={2.25} />
            </span>
            <p className="text-2xl font-bold text-ink">
              {isLoading ? (
                <span className="inline-block h-6 w-10 animate-pulse rounded bg-ink/10" />
              ) : (
                (stats?.[card.key] ?? '—')
              )}
            </p>
            <p className="text-xs text-ink-soft/60">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminOverview
