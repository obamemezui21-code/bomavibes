import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Heart, HeartCrack, Target } from 'lucide-react'
import { getCrushTime, guessCrush } from '../firebase/crushTime.js'
import { isQuotaError } from '../firebase/swipes.js'
import { useToast } from '../context/ToastContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import PaywallModal from '../components/PaywallModal.jsx'
import Confetti from '../components/Confetti.jsx'

// CrushTime (as on happn): 4 profiles, one of them liked you — find which.
function CrushTime() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { requireIdentity } = useIdentity()
  const [data, setData] = useState(null) // { playsLeft, waiting, round }
  const [result, setResult] = useState(null) // { correct, pickedId, crush, matchId }
  const [isGuessing, setIsGuessing] = useState(false)
  const [paywall, setPaywall] = useState(null)

  function load() {
    getCrushTime()
      .then(setData)
      .catch(() => setData({ playsLeft: 0, waiting: 0, round: null, failed: true }))
  }

  useEffect(load, [])

  async function guess(option) {
    if (isGuessing || result || !requireIdentity()) return
    setIsGuessing(true)
    try {
      const r = await guessCrush(option.id)
      setResult({ ...r, pickedId: option.id })
      setData((d) => ({ ...d, playsLeft: Math.max(0, d.playsLeft - 1) }))
    } catch (err) {
      if (isQuotaError(err)) setPaywall({ reason: 'likes', message: err.message })
      else showToast(err.message || 'Impossible de valider ton choix, réessaie.', 'error')
    } finally {
      setIsGuessing(false)
    }
  }

  function nextRound() {
    setResult(null)
    setData(null)
    load()
  }

  const round = data?.round

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/likes')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">CrushTime</h1>
        {data && (
          <span className="ml-auto rounded-full bg-violet-500/12 px-3 py-1 text-xs font-semibold text-violet-700">
            {data.playsLeft} essai{data.playsLeft > 1 ? 's' : ''} aujourd'hui
          </span>
        )}
      </div>

      <div className="mx-auto max-w-md px-4 pt-5">
        <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 p-4 text-white">
          <Target size={22} strokeWidth={2} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            Parmi ces 4 profils, <strong>une personne t'a aimé·e</strong>. Trouve-la et c'est un match ! Une seule chance
            par manche.
          </p>
        </div>

        {!data ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : !round && !result ? (
          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <Heart size={32} strokeWidth={1.5} className="text-ink-soft/40" />
            <p className="max-w-xs text-sm text-ink-soft/70">
              {data.failed
                ? 'Impossible de charger CrushTime, réessaie plus tard.'
                : data.playsLeft === 0
                  ? 'Tu as utilisé tes 3 essais du jour. Reviens demain !'
                  : 'Pas de nouveau crush à deviner pour l’instant. Continue à liker, ça arrive vite 👀'}
            </p>
          </div>
        ) : (
          <>
            {round && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {round.options.map((o) => {
                  const picked = result?.pickedId === o.id
                  const isCrush = result?.crush?.id === o.id
                  return (
                    <motion.button
                      key={o.id}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={isGuessing || !!result}
                      onClick={() => guess(o)}
                      className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink/10 text-left transition ${
                        result && !picked ? 'opacity-50' : ''
                      } ${picked ? (result.correct ? 'ring-4 ring-heart-500' : 'ring-4 ring-ink/40') : ''}`}
                    >
                      <img
                        src={photoVariant(o.photo, 'medium') || o.photo || fallbackAvatar(o.firstName || o.id)}
                        onError={o.photo ? fallbackToFullPhoto(o.photo) : undefined}
                        alt={o.firstName}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="flex items-center gap-1 truncate font-display text-sm font-semibold text-white">
                          {o.firstName}
                          {o.age ? `, ${o.age}` : ''}
                          {o.verified && (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500">
                              <Check size={8} strokeWidth={3.5} />
                            </span>
                          )}
                        </p>
                        {o.city && <p className="truncate text-[10px] uppercase tracking-wider text-white/70">{o.city}</p>}
                      </div>
                      {isCrush && (
                        <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-heart-500 text-white shadow">
                          <Heart size={15} strokeWidth={2.5} fill="currentColor" />
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-sm dark:bg-surface-tint"
                >
                  {result.correct ? (
                    <>
                      <Confetti />
                      <p className="font-display text-lg font-semibold text-ink">
                        Bien vu ! C'est un match avec {result.crush?.firstName} 💜
                      </p>
                      {result.matchId && (
                        <button
                          type="button"
                          onClick={() => navigate(`/chat/${result.matchId}`)}
                          className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white"
                        >
                          Envoyer un message
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <HeartCrack size={28} strokeWidth={1.75} className="text-ink-soft/60" />
                      <p className="text-sm text-ink-soft">
                        Raté ! Ton crush reste un mystère… Il ou elle t'attend peut-être encore dans Discover.
                      </p>
                    </>
                  )}
                  {data.playsLeft > 0 && (
                    <button
                      type="button"
                      onClick={nextRound}
                      className="rounded-full border border-ink/12 px-6 py-2 text-sm font-semibold text-ink/80 transition hover:bg-ink/5"
                    >
                      Manche suivante
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {paywall && <PaywallModal reason={paywall.reason} message={paywall.message} onClose={() => setPaywall(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default CrushTime
