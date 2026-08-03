import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useConversations } from '../context/ConversationsContext.jsx'

function PushPermissionPrompt() {
  const { showPushPrompt, acceptPushPrompt, dismissPushPrompt } = useConversations()

  if (!showPushPrompt) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-6"
      onClick={dismissPushPrompt}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-[280px] overflow-hidden rounded-2xl p-4 text-center"
      >
        <span className="relative mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/30">
          <Bell size={20} strokeWidth={2} />
        </span>

        <h2 className="relative mt-3 font-display text-base font-bold text-ink">Active tes notifications</h2>
        <p className="relative mt-1.5 text-xs leading-relaxed text-ink-soft/70">
          Sois averti(e) des likes, matchs et messages, même app fermée.
        </p>

        <div className="relative mt-4 flex flex-col gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={acceptPushPrompt}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 py-2 text-xs font-semibold text-[#2B1D14] shadow-md shadow-violet-500/25"
          >
            Activer
          </motion.button>
          <button
            type="button"
            onClick={dismissPushPrompt}
            className="rounded-lg border border-ink/12 py-2 text-xs font-medium text-ink/80 transition hover:bg-ink/5"
          >
            Plus tard
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default PushPermissionPrompt
