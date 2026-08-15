import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Search, Send } from 'lucide-react'
import { useConversations } from '../../context/ConversationsContext.jsx'
import { fallbackToFullPhoto } from '../../lib/photoVariants.js'

function SendToModal({ post, onClose }) {
  const { conversations, sendPostMessage } = useConversations()
  const [query, setQuery] = useState('')
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)

  const filtered = conversations.filter((c) =>
    c.profile.firstName?.toLowerCase().includes(query.trim().toLowerCase()),
  )

  async function handleSend(matchId) {
    if (sendingId || sentIds.has(matchId)) return
    setSendingId(matchId)
    try {
      await sendPostMessage(matchId, post)
      setSentIds((prev) => new Set(prev).add(matchId))
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-sm flex-col rounded-2xl p-6"
      >
        <div className="flex items-center gap-2">
          <Send size={18} strokeWidth={2.25} className="text-violet-600" />
          <h2 className="font-display text-lg font-semibold text-ink">Envoyer à</h2>
        </div>

        {conversations.length > 0 && (
          <div className="relative mt-4">
            <Search size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un match"
              className="w-full rounded-xl border border-ink/12 bg-ink/[0.03] py-2.5 pl-9 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15"
            />
          </div>
        )}

        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft/60">
              Faites un match pour pouvoir partager ici.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft/60">Aucun résultat.</p>
          ) : (
            filtered.map((c) => {
              const sent = sentIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={sendingId === c.id || sent}
                  onClick={() => handleSend(c.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-ink/5 disabled:cursor-default"
                >
                  <img
                    src={c.profile.photo}
                    onError={fallbackToFullPhoto(c.profile.photoFull)}
                    alt={c.profile.firstName}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.profile.firstName}</span>
                  <span
                    className={`flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition ${
                      sent
                        ? 'bg-mint-500/15 text-mint-600'
                        : sendingId === c.id
                          ? 'bg-ink/5 text-ink-soft/50'
                          : 'bg-violet-500/10 text-violet-600'
                    }`}
                  >
                    {sent ? (
                      <span className="flex items-center gap-1">
                        <Check size={13} strokeWidth={2.5} />
                        Envoyé
                      </span>
                    ) : sendingId === c.id ? (
                      '…'
                    ) : (
                      'Envoyer'
                    )}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
        >
          Fermer
        </button>
      </motion.div>
    </div>
  )
}

export default SendToModal
