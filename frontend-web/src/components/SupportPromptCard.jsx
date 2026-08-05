import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, X } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'

const MIN_DAYS_ACTIVE = 3
const MIN_CONVERSATIONS = 3

function isEligible(profile, conversations) {
  if (profile?.supportPromptDismissed) return false

  const hasFirstMatch = conversations.length >= 1
  const hasSeveralConversations = conversations.filter((c) => c.lastMessage).length >= MIN_CONVERSATIONS

  const createdAt = profile?.createdAt?.toDate?.()
  const daysActive = createdAt ? (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000) : 0
  const isRegularUser = daysActive >= MIN_DAYS_ACTIVE

  return hasFirstMatch || hasSeveralConversations || isRegularUser
}

function SupportPromptCard() {
  const { user, profile } = useAuth()
  const { conversations } = useConversations()
  const navigate = useNavigate()
  const [dismissedLocally, setDismissedLocally] = useState(false)

  if (dismissedLocally || !isEligible(profile, conversations)) return null

  async function handleDismiss() {
    setDismissedLocally(true)
    await updateDoc(doc(db, 'users', user.id), { supportPromptDismissed: true }).catch(() => {})
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 overflow-hidden"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-coral-400/30 bg-gradient-to-r from-coral-500/10 to-violet-500/10 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral-500/15 text-coral-500">
          <Heart size={16} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Vous appréciez BomaVibes ?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft/70">
            Si BomaVibes vous aide à créer de nouvelles connexions et que vous aimez le projet, vous pouvez
            soutenir son développement.
          </p>
          <button
            type="button"
            onClick={() => navigate('/soutenir')}
            className="mt-2 text-xs font-semibold text-violet-600 underline-offset-2 hover:underline"
          >
            Soutenir BomaVibes →
          </button>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft/50 transition hover:bg-ink/5"
          aria-label="Fermer"
        >
          <X size={14} strokeWidth={2.25} />
        </button>
      </div>
    </motion.div>
  )
}

export default SupportPromptCard
