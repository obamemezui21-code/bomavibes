import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, EyeOff, Rocket } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getSwipeQuota } from '../firebase/swipes.js'
import { boostMyProfile, setInvisibleMode } from '../firebase/subscriptions.js'
import { activePlan, isActiveUntil, periodLabel, planExpiry } from '../lib/plans.js'

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// "Mon abonnement" on the profile page: plan and end date, what's left of
// the likes / super likes, and the subscriber perks (Boost, invisible mode).
function SubscriptionCard() {
  const navigate = useNavigate()
  const { user, profile: account, publicProfile } = useAuth()
  const { showToast } = useToast()
  const plan = activePlan(account)
  const expiry = planExpiry(account)
  const [quota, setQuota] = useState(null)
  const [boostedUntil, setBoostedUntil] = useState(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getSwipeQuota()
      .then((q) => setQuota(q.remaining))
      .catch(() => setQuota(null))
  }, [user?.id, plan.id])

  const serverBoost = publicProfile?.boostedUntil?.toMillis?.() || 0
  const boostEnd = Math.max(serverBoost, boostedUntil || 0)
  const isBoosted = isActiveUntil(boostEnd)
  const invisible = !!publicProfile?.invisible && plan.invisible

  async function handleBoost() {
    setIsBusy(true)
    try {
      const { boostedUntil: until } = await boostMyProfile()
      setBoostedUntil(until)
      showToast(`Boost activé jusqu'à ${formatTime(until)} 🚀`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleInvisible() {
    setIsBusy(true)
    try {
      await setInvisibleMode(!invisible)
      showToast(invisible ? 'Vous êtes de nouveau visible.' : 'Mode invisible activé.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const quotaLine =
    quota &&
    [
      quota.likes === null ? 'Likes illimités' : `${quota.likes} like${quota.likes > 1 ? 's' : ''} restant${quota.likes > 1 ? 's' : ''} aujourd'hui`,
      `${quota.superlikes} Super Like${quota.superlikes > 1 ? 's' : ''} restant${quota.superlikes > 1 ? 's' : ''} (${plan.superlikes.count} ${periodLabel(plan.superlikes.period)})`,
    ].join(' · ')

  if (plan.id === 'free') {
    return (
      <div className="glass-panel mb-6 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-950 text-white">
            <Crown size={20} strokeWidth={2.25} />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-ink">Compte gratuit</p>
            {quotaLine && <p className="text-sm text-ink-soft/70">{quotaLine}</p>}
            <p className="mt-1 text-sm text-ink-soft/70">
              Passez à un forfait pour les likes illimités, voir qui vous aime, les appels audio &amp; vidéo et le Boost.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/tarifs')}
          className="mt-4 w-full rounded-full bg-violet-950 py-3 text-sm font-semibold text-white transition hover:bg-violet-950/90 dark:bg-pink-500"
        >
          Voir les forfaits
        </button>
      </div>
    )
  }

  return (
    <div className="glass-panel mb-6 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-950 text-xl">{plan.emoji}</span>
        <div>
          <p className="font-display text-base font-semibold text-ink">Forfait {plan.label}</p>
          {expiry && (
            <p className="text-sm text-ink-soft/70">
              Actif jusqu'au {expiry.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {quotaLine && <p className="text-sm text-ink-soft/70">{quotaLine}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={handleBoost}
          disabled={isBusy || isBoosted}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-950 py-3 text-sm font-semibold text-white transition hover:bg-violet-950/90 disabled:opacity-60 dark:bg-pink-500"
        >
          <Rocket size={16} strokeWidth={2.25} />
          {isBoosted
            ? `Boost en cours jusqu'à ${formatTime(boostEnd)}`
            : `Booster mon profil 30 min (${plan.boosts.count} ${periodLabel(plan.boosts.period)})`}
        </button>

        {plan.invisible && (
          <button
            type="button"
            onClick={handleInvisible}
            disabled={isBusy}
            aria-pressed={invisible}
            className={`flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-semibold transition disabled:opacity-60 ${
              invisible ? 'border-violet-950 bg-violet-950/10 text-violet-950 dark:text-white' : 'border-ink/12 text-ink hover:bg-ink/5'
            }`}
          >
            <EyeOff size={16} strokeWidth={2.25} />
            {invisible ? 'Mode invisible activé — désactiver' : 'Activer le mode invisible'}
          </button>
        )}
        {plan.invisible && (
          <p className="text-xs text-ink-soft/60">
            En mode invisible, vous n'apparaissez plus dans Discover et votre statut « en ligne » est masqué. Vous pouvez
            toujours liker et discuter avec vos matchs.
          </p>
        )}
      </div>
    </div>
  )
}

export default SubscriptionCard
