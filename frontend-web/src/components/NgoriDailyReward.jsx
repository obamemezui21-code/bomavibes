import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { claimDailyNgori } from '../firebase/ngori.js'
import { STREAK_BONUS } from '../lib/ngori.js'
import NgoriCoin from './NgoriCoin.jsx'

// Collects today's Ngori when the app opens and celebrates it. The server
// only pays once per day, so re-opening the app just gets { gained: 0 } and
// shows nothing.
function NgoriDailyReward() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reward, setReward] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    claimDailyNgori()
      .then((r) => {
        if (!cancelled && r.gained > 0) setReward(r)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const close = () => setReward(null)
  const dayInStreak = reward ? ((reward.streak - 1) % reward.streakLength) + 1 : 0

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ngori-daily-title"
        >
          <motion.div
            initial={{ y: 30, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-[28px] bg-violet-950 p-6 text-center text-white shadow-2xl"
          >
            <motion.div
              initial={{ rotateY: 0, y: -10 }}
              animate={{ rotateY: 720, y: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-fit"
            >
              <NgoriCoin size={84} />
            </motion.div>

            <h2 id="ngori-daily-title" className="mt-4 font-display text-2xl font-bold">
              +{reward.gained} Ngori
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {reward.verifiedBonus > 0 && <span className="block">+{reward.verifiedBonus} grâce à votre profil vérifié ✓</span>}
              {reward.bonus > 0
                ? `Bonus de série : +${reward.bonus} pour ${reward.streakLength} jours d'affilée 🔥`
                : 'Votre Ngori du jour. Revenez demain pour le suivant !'}
            </p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Série : {reward.streak} jour{reward.streak > 1 ? 's' : ''} 🔥
              </p>
              <div className="mt-2 flex justify-center gap-1.5">
                {Array.from({ length: reward.streakLength }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < dayInStreak ? 'bg-gold' : 'bg-white/15'}`}
                  />
                ))}
              </div>
              {reward.bonus === 0 && (
                <p className="mt-2 text-[11px] text-white/50">
                  +{STREAK_BONUS} Ngori bonus au jour {reward.streakLength}
                </p>
              )}
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold">
              Solde : <NgoriCoin size={16} /> {reward.balance}
            </p>

            <button
              type="button"
              onClick={() => {
                close()
                navigate('/ngori')
              }}
              className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-violet-950 transition hover:bg-white/90"
            >
              Voir ce que je peux débloquer
            </button>
            <button
              type="button"
              onClick={() => {
                close()
                navigate('/ngori-run')
              }}
              className="mt-2 w-full rounded-full border border-white/25 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              🏃 Gagner plus en jouant à Ngori Run
            </button>
            <button type="button" onClick={close} className="mt-2 w-full py-2 text-sm text-white/70 hover:text-white">
              Continuer
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default NgoriDailyReward
