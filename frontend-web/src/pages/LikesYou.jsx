import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Heart, Lock, Sparkles, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getIncomingLikers, isQuotaError, recordSwipeAndMatch } from '../firebase/swipes.js'
import { matchPercent } from '../lib/interests.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import PaywallModal from '../components/PaywallModal.jsx'

// "Qui t'a aimé·e": people who liked this user and are still waiting for an
// answer. Subscribers see them (served by the backend only to them); free
// accounts only see how many.
function LikesYou() {
  const navigate = useNavigate()
  const { user, publicProfile } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null) // { locked, count, likers }
  const [openProfile, setOpenProfile] = useState(null)
  const [paywall, setPaywall] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    getIncomingLikers()
      .then(setData)
      .catch(() => setData({ locked: true, count: 0, likers: [] }))
  }, [user?.id])

  async function answer(profile, direction) {
    setData((prev) => ({ ...prev, count: prev.count - 1, likers: prev.likers.filter((p) => p.id !== profile.id) }))
    try {
      const matchId = await recordSwipeAndMatch(user.id, profile.id, direction, user.firstName)
      if (matchId) {
        showToast(`C'est un match avec ${profile.firstName} !`, 'success')
        navigate(`/chat/${matchId}`)
      }
    } catch (err) {
      setData((prev) => ({ ...prev, count: prev.count + 1, likers: [profile, ...prev.likers] }))
      if (isQuotaError(err)) setPaywall({ reason: 'superlikes', message: err.message })
      else showToast("Impossible d'enregistrer votre choix, réessayez.", 'error')
    }
  }

  const isLoading = data === null
  const count = data?.count ?? 0

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Qui t'a aimé·e</h1>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Sparkles size={32} strokeWidth={1.5} className="text-ink-soft/40" />
            <p className="text-sm text-ink-soft/60">
              Personne n'attend ta réponse pour l'instant. Continue à swiper, ça ne va pas tarder 👀
            </p>
          </div>
        ) : data.locked ? (
          <>
            <p className="text-sm text-ink-soft/70">
              <span className="font-semibold text-ink">{count}</span> personne{count > 1 ? 's' : ''}{' '}
              {count > 1 ? "t'ont" : "t'a"} déjà aimé·e.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: Math.min(count, 9) }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/40 to-pink-600/60 text-white"
                >
                  <Lock size={20} strokeWidth={2} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Réservé aux abonnés</span>
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-heart-500 text-white shadow">
                    <Heart size={12} strokeWidth={2.5} fill="currentColor" />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-violet-950 p-6 text-center text-white">
              <p className="text-sm text-white/80">
                Découvre qui t'a aimé·e et matche en un geste, avec un forfait dès 2 000 FCFA par mois.
              </p>
              <button
                type="button"
                onClick={() => setPaywall({ reason: 'likers' })}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-violet-950 transition hover:bg-white/90"
              >
                Voir qui m'a aimé·e
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-soft/70">
              <span className="font-semibold text-ink">{count}</span> personne{count > 1 ? 's' : ''} attend
              {count > 1 ? 'ent' : ''} ta réponse. Like en retour pour matcher.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data.likers.map((p, i) => (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenProfile(p)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.3 }}
                  className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink/10 text-left"
                >
                  <img
                    src={photoVariant(p.photos?.[0], 'medium') || p.photos?.[0]}
                    onError={p.photos?.[0] ? fallbackToFullPhoto(p.photos[0]) : undefined}
                    alt={p.firstName}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span
                    className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white shadow ${
                      p.superlike ? 'bg-violet-950' : 'bg-heart-500'
                    }`}
                    title={p.superlike ? 'Super Like' : 'Like'}
                  >
                    {p.superlike ? <Star size={13} strokeWidth={2.5} fill="currentColor" /> : <Heart size={13} strokeWidth={2.5} fill="currentColor" />}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="flex items-center gap-1 truncate font-display text-sm font-semibold text-white">
                      {p.firstName}
                      {p.age ? `, ${p.age}` : ''}
                      {p.verified && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500">
                          <Check size={8} strokeWidth={3.5} />
                        </span>
                      )}
                    </p>
                    {p.city && <p className="truncate text-[10px] uppercase tracking-wider text-white/70">{p.city}</p>}
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {openProfile && (
          <ProfileDetailModal
            profile={openProfile}
            matchPercent={matchPercent(publicProfile?.interests, openProfile.interests)}
            onClose={() => setOpenProfile(null)}
            onLike={() => answer(openProfile, 'like')}
            onSuperlike={() => answer(openProfile, 'superlike')}
            onPass={() => answer(openProfile, 'pass')}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {paywall && <PaywallModal reason={paywall.reason} message={paywall.message} onClose={() => setPaywall(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default LikesYou
