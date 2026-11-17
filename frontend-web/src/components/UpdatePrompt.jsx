import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useCall } from '../context/CallContext.jsx'
import { useGroupCall } from '../context/GroupCallContext.jsx'
import { installUpdate, usePwa } from '../lib/pwa.js'

// "Plus tard" puts the banner away for this long, then it comes back.
const LATER_MS = 10 * 60 * 1000

// "A new version is available": offered, never forced (the page reloads to
// switch), but hard to miss: the brand's colours, a big button. Kept out of
// the way during a call, where a reload would hang up. "Plus tard" hides it
// for 10 minutes; the new version also starts by itself the next time the
// app is opened.
function UpdatePrompt() {
  const { updateReady } = usePwa()
  const { call } = useCall()
  const { session } = useGroupCall()
  const [later, setLater] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!later) return undefined
    const id = setTimeout(() => setLater(false), LATER_MS)
    return () => clearTimeout(id)
  }, [later])

  const open = (updateReady || updating) && !later && !call && !session

  function update() {
    setUpdating(true)
    installUpdate()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: -40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          role="alert"
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[96] mx-auto max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-brand-1 via-brand-2 to-brand-3 p-4 text-white shadow-[0_18px_40px_-12px_rgba(123,31,162,0.65)] ring-1 ring-white/20"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/25 motion-reduce:hidden" />
              <Sparkles size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold leading-tight">Nouvelle version disponible !</p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/85">Mets BomaVibes à jour pour profiter des dernières nouveautés.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={update}
              disabled={updating}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-brand-1 shadow-md transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-80"
            >
              <RefreshCw size={16} strokeWidth={2.5} className={updating ? 'animate-spin' : ''} />
              {updating ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
            {!updating && (
              <button
                type="button"
                onClick={() => setLater(true)}
                className="rounded-full px-3.5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15"
              >
                Plus tard
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdatePrompt
