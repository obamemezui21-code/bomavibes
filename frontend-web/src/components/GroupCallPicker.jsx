import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Phone, Search, Video, X } from 'lucide-react'
import { useConversations } from '../context/ConversationsContext.jsx'
import { MAX_GROUP_CALL_MEMBERS } from '../firebase/groupCalls.js'

// Choose which matches to call together (or to add to a running group
// call). `excludeIds` are already in the call; `slotsLeft` how many more
// people fit. onConfirm(ids, type) — type only when `chooseType`.
function GroupCallPicker({ title, initialIds = [], excludeIds = [], slotsLeft = MAX_GROUP_CALL_MEMBERS - 1, chooseType, onConfirm, onClose }) {
  const { conversations } = useConversations()
  const [selected, setSelected] = useState(() => new Set(initialIds))
  const [search, setSearch] = useState('')

  const people = useMemo(() => {
    const term = search.trim().toLowerCase()
    return conversations
      .filter((c) => !excludeIds.includes(c.otherUid))
      .filter((c) => !term || c.profile.firstName?.toLowerCase().includes(term))
  }, [conversations, excludeIds, search])

  function toggle(uid) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else if (next.size < slotsLeft) next.add(uid)
      return next
    })
  }

  const ids = [...selected]
  const full = selected.size >= slotsLeft

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85svh] w-full max-w-md flex-col rounded-t-3xl bg-white text-ink shadow-2xl dark:bg-surface-tint sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <p className="text-xs text-ink-soft/70">
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''} · {slotsLeft} au maximum
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-2">
          <label className="flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2">
            <Search size={16} className="text-ink-soft/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un match"
              className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
            />
          </label>
        </div>

        <ul className="flex-1 overflow-y-auto px-3 pb-2">
          {people.length === 0 && <li className="py-8 text-center text-sm text-ink-soft/60">Aucun match à inviter.</li>}
          {people.map((c) => {
            const isOn = selected.has(c.otherUid)
            const disabled = !isOn && full
            return (
              <li key={c.otherUid}>
                <button
                  type="button"
                  onClick={() => toggle(c.otherUid)}
                  disabled={disabled}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-ink/5 disabled:opacity-40"
                >
                  <img src={c.profile.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.profile.firstName}</span>
                    {c.online && <span className="text-xs text-mint-500">En ligne</span>}
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      isOn ? 'border-violet-500 bg-violet-500 text-white' : 'border-ink/20'
                    }`}
                  >
                    {isOn && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex gap-2 border-t border-ink/8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {chooseType ? (
            <>
              <button
                type="button"
                disabled={ids.length === 0}
                onClick={() => onConfirm(ids, 'audio')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-950 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white/10"
              >
                <Phone size={16} /> Audio
              </button>
              <button
                type="button"
                disabled={ids.length === 0}
                onClick={() => onConfirm(ids, 'video')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Video size={16} /> Vidéo
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={ids.length === 0}
              onClick={() => onConfirm(ids)}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Inviter
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default GroupCallPicker
