import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import logo from '../assets/bomavibes-icon.png'

const HOLD_MS = 1600

function SplashScreen({ onFinish }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), HOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#12271B]"
        >
          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.55, 0.35], scale: [0.7, 1.15, 1.3] }}
            transition={{ duration: 2.4, ease: 'easeOut', times: [0, 0.5, 1] }}
            className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full bg-[#E8C468] blur-[110px]"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(232,196,104,0.14)_0%,_transparent_60%)]"
          />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.55, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <motion.div
              animate={{ scale: [1, 1.035, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
              className="relative flex h-32 w-32 items-center justify-center rounded-full bg-[#0E1D14] shadow-[0_0_60px_rgba(232,196,104,0.35)] ring-2 ring-[#E8C468]/70 sm:h-40 sm:w-40"
            >
              <img src={logo} alt="BomaVibes" className="h-[78%] w-[78%] rounded-full object-cover" />
            </motion.div>
          </motion.div>

          {/* Wordmark */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: 'easeOut' }}
            className="mt-7 font-display text-2xl font-extrabold uppercase tracking-wide text-white sm:text-3xl"
          >
            Boma<span className="text-[#E8C468]">Vibes</span>
          </motion.p>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.95, ease: 'easeOut' }}
            className="mt-2 text-xs font-medium uppercase tracking-[0.25em] text-white/50"
          >
            L'amour a sa vibe
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SplashScreen
