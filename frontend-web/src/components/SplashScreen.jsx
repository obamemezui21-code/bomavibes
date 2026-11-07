import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import logo from '../assets/bomavibes-logo.webp'

const HOLD_MS = 700

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
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-violet-950"
        >
          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.55, 0.35], scale: [0.7, 1.15, 1.3] }}
            transition={{ duration: 2.4, ease: 'easeOut', times: [0, 0.5, 1] }}
            className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full bg-pink-400 blur-[110px]"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(244,114,182,0.14)_0%,_transparent_60%)]"
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
              className="relative w-64 overflow-hidden rounded-3xl bg-white p-2 shadow-[0_0_60px_rgba(244,114,182,0.35)] sm:w-80"
            >
              <img src={logo} alt="" className="block h-auto w-full" />
            </motion.div>
          </motion.div>

          {/* Wordmark: the logo carries the slogan, not the name. */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: 'easeOut' }}
            className="mt-6 font-display text-2xl font-extrabold uppercase tracking-wide text-white sm:text-3xl"
          >
            Boma<span className="text-pink-400">Vibes</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SplashScreen
