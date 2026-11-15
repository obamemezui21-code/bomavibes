import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useCall } from '../context/CallContext.jsx'
import { useGroupCall } from '../context/GroupCallContext.jsx'
import { installUpdate, usePwa } from '../lib/pwa.js'

// "A new version is available": offered, never forced (the page reloads to
// switch). Kept out of the way during a call, where a reload would hang up.
// "Plus tard" hides it for this visit; the new version then starts by itself
// the next time the app is opened.
function UpdatePrompt() {
  const { updateReady } = usePwa()
  const { call } = useCall()
  const { session } = useGroupCall()
  const [later, setLater] = useState(false)

  const open = updateReady && !later && !call && !session

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          role="status"
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[96] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 text-ink shadow-2xl dark:bg-surface-tint"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600">
            <RefreshCw size={18} />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-snug">Une nouvelle version de BomaVibes est disponible. Mettre à jour ?</p>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            <button
              type="button"
              onClick={installUpdate}
              className="rounded-lg bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 px-3 py-1.5 text-xs font-semibold text-ink-on-brand"
            >
              Mettre à jour
            </button>
            <button type="button" onClick={() => setLater(true)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/5">
              Plus tard
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdatePrompt
