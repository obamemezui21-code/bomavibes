import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useConversations } from '../context/ConversationsContext.jsx'

function Chat() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { conversations, typingId, sendMessage, openConversation } = useConversations()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  const activeId = conversationId || conversations[0]?.id
  const active = conversations.find((c) => c.id === activeId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [active?.messages.length, typingId])

  useEffect(() => {
    if (conversationId) openConversation(conversationId)
  }, [conversationId, openConversation])

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    sendMessage(active.id, text)
    setDraft('')
  }

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center md:min-h-full">
        <span className="text-4xl">💬</span>
        <h1 className="font-display text-2xl font-semibold text-ink">Messages</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Tes conversations avec tes matchs apparaîtront ici.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-svh bg-surface-soft md:h-full">
      {/* Conversation list */}
      <div
        className={`w-full flex-col border-r border-ink/8 md:flex md:w-80 ${
          conversationId ? 'hidden' : 'flex'
        }`}
      >
        <div className="border-b border-ink/8 p-5">
          <h1 className="font-display text-xl font-semibold text-ink">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => {
            const last = c.messages[c.messages.length - 1]
            const isActive = c.id === activeId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/chat/${c.id}`)}
                className={`flex w-full items-center gap-3 border-b border-ink/6 px-4 py-3 text-left transition hover:bg-ink/5 ${
                  isActive ? 'bg-violet-500/5' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <img src={c.profile.photo} alt={c.profile.firstName} className="h-12 w-12 rounded-full object-cover" />
                  {c.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink bg-mint-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.profile.firstName}</p>
                  <p className="truncate text-xs text-ink-soft/60">
                    {last ? last.text : 'Dites bonjour 👋'}
                  </p>
                </div>
                {typingId === c.id && <span className="text-xs text-violet-600">écrit…</span>}
                {!!c.unreadCount && typingId !== c.id && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 flex-col md:flex ${conversationId ? 'flex' : 'hidden'}`}>
        {active && (
          <>
            <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate('/chat')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5 md:hidden"
                aria-label="Retour"
              >
                ←
              </button>
              <img src={active.profile.photo} alt={active.profile.firstName} className="h-9 w-9 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-ink">{active.profile.firstName}</p>
                <p className="text-xs text-ink-soft/50">{active.online ? 'En ligne' : active.profile.city}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {active.messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="text-3xl">👋</span>
                  <p className="text-sm text-ink-soft/60">
                    C'est un match avec {active.profile.firstName} ! Envoie le premier message.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {active.messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.fromMe
                          ? 'rounded-br-sm bg-gradient-to-r from-violet-500 to-pink-500 text-[#2B1D14]'
                          : 'rounded-bl-sm bg-ink/6 text-ink'
                      }`}
                    >
                      <p>{m.text}</p>
                      <p className={`mt-0.5 text-[10px] ${m.fromMe ? 'text-white/70' : 'text-ink-soft/50'}`}>
                        {m.time}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {typingId === active.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-ink/6 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-ink-soft/40"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink/8 p-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écris un message…"
                className="flex-1 rounded-full border border-ink/12 bg-ink/[0.03] px-4 py-2.5 text-sm text-ink placeholder-ink-soft/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.9 }}
                disabled={!draft.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-[#2B1D14] shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Envoyer"
              >
                ➤
              </motion.button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default Chat
