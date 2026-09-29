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
    // markMatchesSeen is a fresh reference on every ConversationsProvider
    // re-render — depending on it here would keep resetting this timer
    // during active real-time updates instead of firing once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center desktop:min-h-full">
        <Heart size={40} strokeWidth={1.5} className="text-coral-500" />
        <h1 className="font-display text-2xl font-semibold text-ink">Vos matchs</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Quand vous matchez avec quelqu'un, vous le retrouverez ici.
        </p>
      </div>
    )
  }

  // Photo for the "Discussions" circle: the most recent conversation that
  // actually has messages (conversations are already sorted by activity).
  const latestTalked = conversations.find((c) => c.lastMessage)

  return (
    <div className="min-h-svh bg-surface-soft px-4 pb-28 pt-6 sm:px-6 desktop:min-h-full desktop:pb-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-center font-display text-2xl font-bold text-ink">Matchs</h1>

        {/* Two story-style circles, as at the top of the Friendzy Matches screen */}
        <div className="mt-5 flex justify-center gap-8">
          <button type="button" onClick={() => navigate('/likes')} className="flex flex-col items-center gap-1.5">
            <span className="relative block rounded-full bg-gradient-to-br from-pink-500 to-violet-500 p-[3px] shadow-lg shadow-pink-500/25">
              <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-surface-soft bg-gradient-to-br from-pink-400 to-violet-500 text-white">
                <Heart size={26} strokeWidth={2.25} fill="currentColor" />
              </span>
            </span>
            <span className="text-sm font-semibold text-ink">
              Likes <span className="text-pink-500">{likesCount ?? '–'}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConnectFilter((v) => !v)}
            className="flex flex-col items-center gap-1.5"
            aria-pressed={connectFilter}
          >
            <span
              className={`relative block rounded-full p-[3px] transition ${
                connectFilter ? 'bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/25' : 'bg-ink/12'
              }`}
            >
              {latestTalked ? (
                <img
                  src={latestTalked.profile.photo}
                  onError={fallbackToFullPhoto(latestTalked.profile.photoFull)}
                  alt=""
                  className="h-[68px] w-[68px] rounded-full border-[3px] border-surface-soft object-cover"
                />
              ) : (
                <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-surface-soft bg-violet-500/15 text-violet-600">
                  <MessageCircle size={26} strokeWidth={2.25} />
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white ring-2 ring-surface-soft">
                <MessageCircle size={12} strokeWidth={2.5} />
              </span>
            </span>
            <span className="text-sm font-semibold text-ink">
              Discussions <span className="text-violet-600">{connectedCount}</span>
            </span>
          </button>
        </div>

        <div className="mt-7 flex items-baseline justify-between px-1">
          <h2 className="font-display text-lg font-semibold text-ink">
            {connectFilter ? 'Vos discussions' : 'Vos matchs'}{' '}
            <span className="text-pink-500">{visible.length}</span>
          </h2>
          {connectFilter && (
            <button
              type="button"
              onClick={() => setConnectFilter(false)}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Voir tous les matchs
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/12 py-10 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="text-ink-soft/40" />
            <p className="text-sm text-ink-soft/60">Aucune conversation pour l'instant.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((conversation, i) => {
              const percent = matchPercent(publicProfile?.interests, conversation.profile.interests)
              return (
                <motion.button
                  key={conversation.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                  className={`group relative rounded-[26px] p-[2px] text-left shadow-[0_14px_30px_-12px_rgba(0,0,0,0.4)] ${
                    conversation.isNewMatch ? 'bg-gradient-to-br from-pink-500 to-violet-500' : 'bg-transparent'
                  }`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl">
                    <img
                      src={conversation.profile.photoMedium}
                      onError={fallbackToFullPhoto(conversation.profile.photoFull)}
                      alt={conversation.profile.firstName}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/20" />

                    {percent > 0 && (
                      <span className="absolute left-1/2 top-2.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 text-[11px] font-bold text-ink-on-brand shadow-md">
                        {percent}% Match
                      </span>
                    )}
                    {conversation.isNewMatch && (
                      <span className="absolute right-2.5 top-10 rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        Nouveau
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                      <p className="truncate font-display text-base font-semibold text-white">
                        {conversation.profile.firstName}
                        {conversation.profile.age ? `, ${conversation.profile.age}` : ''}
                      </p>
                      {conversation.profile.city && (
                        <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/70">
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
