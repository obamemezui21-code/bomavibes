import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Heart, Lock, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { getIncomingLikers } from '../firebase/swipes.js'
import { photoVariant } from '../lib/photoVariants.js'

function avatarFor(profile) {
  return (
    photoVariant(profile.photos?.[0], 'thumb') ||
    `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`
  )
}

function LikesYou() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conversations } = useConversations()
  const [likers, setLikers] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    const matchedIds = new Set(conversations.map((c) => c.profile.id))
    getIncomingLikers(user.id)
      .then((profiles) => setLikers(profiles.filter((p) => !matchedIds.has(p.id))))
      .catch(() => setLikers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const isLoading = likers === null
  const count = likers?.length ?? 0

  return (
    <div className="min-h-svh bg-surface-soft pb-24 md:min-h-full md:pb-6">
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
              Personne ne t'a encore aimé·e. Continue à swiper, ça ne va pas tarder 👀
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft/70">
              <span className="font-semibold text-ink">{count}</span> personne{count > 1 ? 's' : ''}{' '}
              {count > 1 ? "t'ont" : "t'a"} déjà aimé·e. Débloque Premium pour voir qui.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {likers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink/10"
                >
                  <img
                    src={avatarFor(p)}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = p.photos?.[0] || avatarFor(p)
                    }}
                    alt=""
                    className="h-full w-full scale-110 object-cover blur-xl"
                  />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white">
                    <Lock size={20} strokeWidth={2} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Premium</span>
                  </div>
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-coral-500 text-white shadow">
                    <Heart size={12} strokeWidth={2.5} fill="currentColor" />
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#C9962B]/30 bg-[#C9962B]/8 p-6 text-center">
              <p className="text-sm text-ink-soft/80">
                Débloque leurs profils, matche instantanément et ne rate plus jamais un like avec
                Premium.
              </p>
              <button
                type="button"
                onClick={() => navigate('/tarifs')}
                className="rounded-xl bg-[#C9962B] px-6 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:bg-[#dba838]"
              >
                Débloquer avec Premium
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LikesYou
