import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { redeemNgori } from '../firebase/ngori.js'
import { FREE_CALLS, activePlan } from '../lib/plans.js'
import { REWARDS, STREAK_BONUS, STREAK_LENGTH, formatRemaining, includedInPlan, perkUntil } from '../lib/ngori.js'
import NgoriCoin from '../components/NgoriCoin.jsx'

// Where each reward leads once unlocked.
const USE_IT = {
  unlimited_likes: { to: '/discover', label: 'Aller liker' },
  see_likes: { to: '/likes', label: 'Voir qui m’aime' },
  calls: { to: '/chat', label: 'Appeler un match' },
}

// "Mes Ngori": balance, login streak and the rewards they buy. The account
// doc is live (AuthContext), so balance and perks update as soon as the
// server writes them.
function Ngori() {
  const navigate = useNavigate()
  const { profile: account, publicProfile } = useAuth()
  const { showToast } = useToast()
  const [busyId, setBusyId] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  // Keeps the countdowns moving.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const plan = activePlan(account, now)
  const balance = account?.ngori || 0
  const streak = account?.ngoriStreak || 0
  const dayInStreak = streak ? ((streak - 1) % STREAK_LENGTH) + 1 : 0
  const boostUntil = publicProfile?.boostedUntil?.toMillis?.() || 0

  function activeUntil(reward) {
    if (reward.perk) return perkUntil(account, reward.perk, now)
    return boostUntil > now ? boostUntil : 0
  }

  async function handleRedeem(reward) {
    setBusyId(reward.id)
    try {
      await redeemNgori(reward.id)
      setNow(() => Date.now())
      showToast(`${reward.emoji} ${reward.label} activé pour ${reward.duration} !`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Mes Ngori</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="rounded-3xl bg-violet-950 p-5 text-white">
          <div className="flex items-center gap-4">
            <NgoriCoin size={56} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Solde</p>
              <p className="font-display text-3xl font-bold">
                {balance} <span className="text-base font-semibold text-white/70">Ngori</span>
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-white/70">
              <span>Série : {streak} jour{streak > 1 ? 's' : ''} 🔥</span>
              <span>
                +{STREAK_BONUS} bonus au jour {STREAK_LENGTH}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: STREAK_LENGTH }).map((_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < dayInStreak ? 'bg-gold' : 'bg-white/15'}`} />
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">
            Ouvrez BomaVibes chaque jour pour gagner 1 Ngori. Ne cassez pas votre série !
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/ngori-run')}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[#5b1f6e] to-[#e9467d] p-4 text-left text-white shadow-lg shadow-pink-500/20 transition active:scale-[0.98]"
        >
          <span className="text-3xl">🏃</span>
          <span className="flex-1">
            <span className="block font-display text-base font-black italic">NGORI RUN</span>
            <span className="block text-xs text-white/80">Cours, esquive, ramasse des Ngori : jusqu'à 5 de plus chaque jour.</span>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-950">Jouer</span>
        </button>

        <h2 className="mt-7 font-display text-base font-semibold text-ink">Débloquer avec mes Ngori</h2>
        <div className="mt-3 space-y-3">
          {REWARDS.map((reward, i) => {
            const until = activeUntil(reward)
            const included = includedInPlan(reward.id, plan)
            const missing = Math.max(0, reward.cost - balance)
            const isActive = until > 0
            return (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className="glass-panel rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-xl">
                    {reward.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-ink">{reward.label}</p>
                    <p className="text-xs text-ink-soft/70">
                      {reward.description} Durée : {reward.duration}.
                    </p>
                    {missing > 0 && !included && !isActive && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(balance / reward.cost) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ink">
                    <NgoriCoin size={16} />
                    {reward.cost}
                  </span>
                </div>

                <div className="mt-3">
                  {included ? (
                    <p className="text-center text-xs font-medium text-mint-500">
                      {reward.id === 'calls' && FREE_CALLS
                        ? 'Gratuits pour tout le monde en ce moment 🎉'
                        : `Déjà inclus dans votre forfait ${plan.label}`}
                    </p>
                  ) : isActive ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 rounded-full bg-mint-500/12 py-2 text-center text-xs font-semibold text-mint-500">
                        ⚡ Actif encore {formatRemaining(until - now)}
                      </span>
                      {USE_IT[reward.id] && (
                        <button
                          type="button"
                          onClick={() => navigate(USE_IT[reward.id].to)}
                          className="rounded-full bg-violet-950 px-4 py-2 text-xs font-semibold text-white dark:bg-pink-500"
                        >
                          {USE_IT[reward.id].label}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRedeem(reward)}
                      disabled={missing > 0 || busyId !== null}
                      className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/20 transition disabled:cursor-not-allowed disabled:from-ink/15 disabled:to-ink/15 disabled:text-ink-soft/60 disabled:shadow-none"
                    >
                      {busyId === reward.id
                        ? 'Activation…'
                        : missing > 0
                          ? `Encore ${missing} Ngori`
                          : `Débloquer pour ${reward.cost} Ngori`}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft/60">
          Envie de tout, tout le temps ?{' '}
          <button type="button" onClick={() => navigate('/tarifs')} className="font-semibold text-violet-600 underline">
            Voir les forfaits
          </button>
        </p>
      </div>
    </div>
  )
}

export default Ngori
