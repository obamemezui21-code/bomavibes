import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Sparkles } from 'lucide-react'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { countIncomingLikes } from '../firebase/swipes.js'
import { matchPercent } from '../lib/interests.js'
import { fallbackToFullPhoto } from '../lib/photoVariants.js'

function Matches() {
  const navigate = useNavigate()
  const { user, publicProfile } = useAuth()
  const { conversations, markMatchesSeen } = useConversations()
  const [likesCount, setLikesCount] = useState(null)
  const [connectFilter, setConnectFilter] = useState(false)

  useEffect(() => {
    const timer = setTimeout(markMatchesSeen, 1200)
    return () => clearTimeout(timer)
  }, [markMatchesSeen])

  useEffect(() => {
    if (!user?.id) return
    countIncomingLikes(user.id).then(setLikesCount).catch(() => setLikesCount(null))
  }, [user?.id])

  const connectedCount = useMemo(() => conversations.filter((c) => c.lastMessage).length, [conversations])
  const visible = useMemo(
    () => (connectFilter ? conversations.filter((c) => c.lastMessage) : conversations),
    [conversations, connectFilter],
  )

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center md:min-h-full">
        <Heart size={40} strokeWidth={1.5} className="text-coral-500" />
        <h1 className="font-display text-2xl font-semibold text-ink">Vos matchs</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Quand vous matchez avec quelqu'un, vous le retrouverez ici.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-surface-soft p-6 pb-24 md:min-h-full md:pb-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink">Vos matchs</h1>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/likes')}
            className="flex flex-1 items-center gap-3 rounded-2xl border border-ink/10 bg-white/60 dark:bg-surface-tint/60 px-4 py-3 text-left transition hover:bg-white/80"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral-500/15 text-coral-500">
              <Heart size={17} strokeWidth={2.25} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{likesCount ?? '–'}</p>
              <p className="text-xs text-ink-soft/60">Vous ont aimé·e</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setConnectFilter((v) => !v)}
            className={`flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              connectFilter ? 'border-violet-400 bg-violet-500/10' : 'border-ink/10 bg-white/60 dark:bg-surface-tint/60 hover:bg-white/80'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600">
              <MessageCircle size={17} strokeWidth={2.25} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{connectedCount}</p>
              <p className="text-xs text-ink-soft/60">En discussion</p>
            </div>
          </button>
        </div>

        <p className="mt-6 text-sm font-semibold text-ink">
          {connectFilter ? 'Vos discussions' : 'Vos matchs'} ({visible.length})
        </p>

        {visible.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/12 py-10 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="text-ink-soft/40" />
            <p className="text-sm text-ink-soft/60">Aucune conversation pour l'instant.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((conversation, i) => {
              const percent = matchPercent(publicProfile?.interests, conversation.profile.interests)
              return (
                <motion.button
                  key={conversation.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                  className="glass-panel group relative overflow-hidden rounded-2xl text-left shadow-lg"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    <img
                      src={conversation.profile.photoMedium}
                      onError={fallbackToFullPhoto(conversation.profile.photoFull)}
                      alt={conversation.profile.firstName}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

                    {percent != null && (
                      <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-[#2B1D14] shadow">
                        {percent}% Match
                      </span>
                    )}
                    {conversation.isNewMatch && (
                      <span className="absolute right-2 top-2 rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        Nouveau
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-display text-base font-semibold text-white">
                        {conversation.profile.firstName}
                        {conversation.profile.age ? `, ${conversation.profile.age}` : ''}
                      </p>
                      {conversation.profile.city && (
                        <p className="truncate text-xs uppercase tracking-wide text-white/70">
                          {conversation.profile.city}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Matches
