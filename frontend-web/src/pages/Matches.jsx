import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useConversations } from '../context/ConversationsContext.jsx'

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return "à l'instant"
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

function Matches() {
  const navigate = useNavigate()
  const { conversations, markMatchesSeen } = useConversations()

  useEffect(() => {
    const timer = setTimeout(markMatchesSeen, 1200)
    return () => clearTimeout(timer)
  }, [markMatchesSeen])

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center md:min-h-full">
        <Heart size={40} strokeWidth={1.5} className="text-coral-500" />
        <h1 className="font-display text-2xl font-semibold text-ink">Tes matchs</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Quand tu matches avec quelqu'un, tu le retrouveras ici.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-surface-soft p-6 pb-24 md:min-h-full md:pb-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink">Tes matchs</h1>
        <p className="mt-1 text-sm text-ink-soft/60">
          {conversations.length} personne{conversations.length > 1 ? 's' : ''} qui te plaisent aussi
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {conversations.map((conversation, i) => {
            const isNew = !conversation.lastMessage

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
                    src={conversation.profile.photo}
                    alt={conversation.profile.firstName}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                  {conversation.isNewMatch && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2B1D14] shadow"
                    >
                      Nouveau
                    </motion.span>
                  )}
                  {conversation.online && (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-mint-500" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-display text-base font-semibold text-white">
                      {conversation.profile.firstName}
                    </p>
                    <p className="truncate text-xs text-white/70">
                      {isNew ? `Matché ${timeAgo(conversation.matchedAt)}` : conversation.lastMessage}
                    </p>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Matches
