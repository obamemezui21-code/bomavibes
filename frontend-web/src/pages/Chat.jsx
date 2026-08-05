import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Hand, MessageCircle, MoreVertical, Pencil, Send, Trash2, TriangleAlert, X } from 'lucide-react'
import { useConversations } from '../context/ConversationsContext.jsx'

const TYPING_STOP_DELAY_MS = 2500

function DeleteMessageModal({ onCancel, onConfirm, isDeleting }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center"
      >
        <TriangleAlert size={32} strokeWidth={1.5} className="mx-auto text-coral-500" />
        <h2 className="mt-2 font-display text-lg font-semibold text-ink">Supprimer ce message ?</h2>
        <p className="mt-1 text-sm text-ink-soft/70">Cette action est définitive et ne peut pas être annulée.</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-coral-500 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function isSameDay(a, b) {
  return !!a && !!b && a.toDateString() === b.toDateString()
}

function formatDayLabel(date) {
  if (!date) return ''
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, now)) return "Aujourd'hui"
  if (isSameDay(date, yesterday)) return 'Hier'
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function Chat() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { conversations, typingId, sendMessage, editMessage, deleteMessage, openConversation, setTyping } =
    useConversations()
  const [draft, setDraft] = useState('')
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const scrollRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)

  const activeId = conversationId || conversations[0]?.id
  const active = conversations.find((c) => c.id === activeId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [active?.messages.length, typingId])

  useEffect(() => {
    if (conversationId) openConversation(conversationId)
  }, [conversationId, openConversation])

  useEffect(() => {
    return () => clearTimeout(typingTimeoutRef.current)
  }, [activeId])

  function handleDraftChange(value) {
    setDraft(value)
    if (!active) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      setTyping(active.id, true)
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      setTyping(active.id, false)
    }, TYPING_STOP_DELAY_MS)
  }

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    clearTimeout(typingTimeoutRef.current)
    isTypingRef.current = false
    setTyping(active.id, false)
    if (editingMessageId) {
      editMessage(active.id, editingMessageId, text)
      setEditingMessageId(null)
    } else {
      sendMessage(active.id, text)
    }
    setDraft('')
  }

  function startEdit(m) {
    setEditingMessageId(m.id)
    setDraft(m.text)
    setOpenMenuId(null)
  }

  function cancelEdit() {
    setEditingMessageId(null)
    setDraft('')
  }

  function handleDelete(m) {
    setOpenMenuId(null)
    setDeleteTarget(m)
  }

  async function confirmDelete() {
    if (!active || !deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteMessage(active.id, deleteTarget.id)
      if (editingMessageId === deleteTarget.id) cancelEdit()
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center md:min-h-full">
        <MessageCircle size={40} strokeWidth={1.5} className="text-ink-soft/40" />
        <h1 className="font-display text-2xl font-semibold text-ink">Messages</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Tes conversations avec tes matchs apparaîtront ici.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-5rem)] bg-surface-soft md:h-full">
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
                <ArrowLeft size={18} strokeWidth={2} />
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
                  <Hand size={32} strokeWidth={1.5} className="text-ink-soft/40" />
                  <p className="text-sm text-ink-soft/60">
                    C'est un match avec {active.profile.firstName} ! Envoie le premier message.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {active.messages.map((m, i) => {
                  const showDaySeparator = !isSameDay(m.date, active.messages[i - 1]?.date)
                  return (
                    <Fragment key={m.id}>
                      {showDaySeparator && (
                        <div className="flex justify-center py-2">
                          <span className="rounded-full bg-ink/8 px-3 py-1 text-[11px] font-medium text-ink-soft/60">
                            {formatDayLabel(m.date)}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className={`flex items-center gap-1 ${m.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {m.fromMe && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft/50 transition hover:bg-ink/5 hover:text-ink-soft active:bg-ink/10"
                              aria-label="Options du message"
                            >
                              <MoreVertical size={14} strokeWidth={2.25} />
                            </button>
                            <AnimatePresence>
                              {openMenuId === m.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => startEdit(m)}
                                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                                  >
                                    <Pencil size={14} strokeWidth={2.25} />
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(m)}
                                    className="flex w-full items-center gap-2 border-t border-ink/6 px-3.5 py-2.5 text-left text-sm font-medium text-coral-500 hover:bg-coral-500/5"
                                  >
                                    <Trash2 size={14} strokeWidth={2.25} />
                                    Supprimer
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
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
                            {m.edited && ' · modifié'}
                          </p>
                        </div>
                      </motion.div>
                    </Fragment>
                  )
                })}
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

            {editingMessageId && (
              <div className="flex items-center justify-between border-t border-ink/8 bg-violet-500/5 px-4 py-2">
                <span className="text-xs font-medium text-violet-600">Modification du message</span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
                  aria-label="Annuler la modification"
                >
                  <X size={14} strokeWidth={2.25} />
                </button>
              </div>
            )}
            <form
              onSubmit={handleSend}
              className={`flex items-center gap-2 p-3 ${editingMessageId ? '' : 'border-t border-ink/8'}`}
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder="Écris un message…"
                className="flex-1 rounded-full border border-ink/12 bg-ink/[0.03] px-4 py-2.5 text-sm text-ink placeholder-ink-soft/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.9 }}
                disabled={!draft.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-[#2B1D14] shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={editingMessageId ? 'Enregistrer' : 'Envoyer'}
              >
                <Send size={16} strokeWidth={2.25} />
              </motion.button>
            </form>
          </>
        )}
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteMessageModal
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Chat
