import { useEffect, useState } from 'react'
import { Heart, MessageSquareWarning, Newspaper, Users } from 'lucide-react'
import { fetchAdminActivity, fetchAdminStats } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import Sparkline from '../components/Sparkline.jsx'

const CARDS = [
  {
    key: 'totalUsers',
    label: 'Utilisateurs',
    icon: Users,
    color: 'from-violet-500 to-indigo-500',
    trendField: 'signups',
    accentClass: 'bg-violet-500',
    dimClass: 'bg-violet-500/20',
  },
  {
    key: 'totalMatches',
    label: 'Matchs',
    icon: Heart,
    color: 'from-pink-500 to-rose-500',
    trendField: 'matches',
    accentClass: 'bg-pink-500',
    dimClass: 'bg-pink-500/20',
  },
  {
    key: 'totalPosts',
    label: 'Publications',
    icon: Newspaper,
    color: 'from-sky-500 to-cyan-500',
    trendField: 'posts',
    accentClass: 'bg-sky-500',
    dimClass: 'bg-sky-500/20',
  },
  { key: 'pendingReports', label: 'Signalements en attente', icon: MessageSquareWarning, color: 'from-amber-500 to-orange-500' },
]

// Read-only, so every elevated role that can enter /admin (Admin, Super
// Admin, Moderator, Editor) sees it — RequireAdmin already gated entry
// with the same check (hasAdminAccess), so there's no narrower case to
// redirect away here, unlike the other admin sections.
function AdminOverview() {
  const { showToast } = useToast()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAdminStats(), fetchAdminActivity()])
      .then(([statsData, activityData]) => {
        if (cancelled) return
        setStats(statsData)
        setActivity(activityData.series)
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
            {card.trendField && activity && (
              <Sparkline
                data={activity.map((point) => ({ date: point.date, value: point[card.trendField] }))}
                accentClass={card.accentClass}
                dimClass={card.dimClass}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminOverview
