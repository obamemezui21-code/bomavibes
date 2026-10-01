import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'

const MESSAGES = [
  'On peaufine votre profil…',
  'On allume vos vibes…',
  'On cherche des personnes qui vous ressemblent…',
  'Presque prêt…',
]
const ORBIT_EMOJIS = ['💜', '✨', '🔥', '💬', '🎶', '🌍']
const BURST_COLORS = ['#8b5cf6', '#ec4899', '#f472b6', '#c4b5fd', '#ffffff']

// Drawn once per mount so re-renders don't retarget the burst mid-flight.
function makeBurst() {
  return Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.3
    const distance = 140 + Math.random() * 120
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 6 + Math.random() * 6,
      color: BURST_COLORS[i % BURST_COLORS.length],
      duration: 0.9 + Math.random() * 0.4,
    }
  })
}

// Full-screen, centred animation shown while the onboarding profile is saved.
// `done` switches it to a short celebration before the caller navigates away.
function ProfileLaunchOverlay({ photoUrl, firstName, done }) {
  const reduceMotion = useReducedMotion()
  const [messageIndex, setMessageIndex] = useState(0)
  const [burst] = useState(makeBurst)

  useEffect(() => {
    if (done) return undefined
    const id = setInterval(() => setMessageIndex((i) => (i + 1) % MESSAGES.length), 1600)
    return () => clearInterval(id)
  }, [done])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-violet-950 via-[#2a0f3a] to-pink-950 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
    >
      {/* Soft drifting glow behind everything */}
      <motion.div
        className="absolute h-[28rem] w-[28rem] rounded-full bg-pink-500/20 blur-3xl"
        animate={reduceMotion ? undefined : { scale: [1, 1.25, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* Expanding pulse rings */}
        {!reduceMotion &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-36 w-36 rounded-full border-2 border-pink-400/60"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
            />
          ))}

        {/* Orbiting emojis */}
        {!done && !reduceMotion && (
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          >
            {ORBIT_EMOJIS.map((emoji, i) => {
              const angle = (i / ORBIT_EMOJIS.length) * Math.PI * 2
              return (
                <motion.span
                  key={emoji}
                  className="absolute text-2xl"
                  style={{
                    left: `calc(50% + ${Math.cos(angle) * 118}px - 0.75rem)`,
                    top: `calc(50% + ${Math.sin(angle) * 118}px - 0.75rem)`,
                  }}
                  animate={{ rotate: -360, scale: [1, 1.25, 1] }}
                  transition={{
                    rotate: { duration: 9, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 1.6, repeat: Infinity, delay: i * 0.25 },
                  }}
                >
                  {emoji}
                </motion.span>
              )
            })}
          </motion.div>
        )}

        {/* Spinning gradient halo + avatar */}
        <div className="relative h-36 w-36">
          <motion.div
            className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_0deg,#8b5cf6,#ec4899,#f9a8d4,#8b5cf6)]"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: done ? 0.6 : 2.2, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-[#2a0f3a] bg-gradient-to-br from-violet-500 to-pink-500"
            animate={done ? { scale: [1, 1.18, 1] } : reduceMotion ? undefined : { scale: [1, 1.05, 1] }}
            transition={done ? { duration: 0.5 } : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Heart className="h-14 w-14 fill-white text-white" />
            )}
          </motion.div>

          {/* Heartbeat badge */}
          <motion.div
            className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-pink-500 shadow-lg shadow-pink-500/50"
            animate={reduceMotion ? undefined : { scale: [1, 1.3, 1, 1.2, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Heart className="h-5 w-5 fill-white text-white" />
          </motion.div>
        </div>

        {/* Celebration burst once saved */}
        {done &&
          !reduceMotion &&
          burst.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full"
              style={{ width: p.size, height: p.size, backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
              transition={{ duration: p.duration, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
      </div>

      <div className="relative mt-8 h-16 w-full max-w-sm text-center">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              <p className="text-2xl font-bold text-white">C&apos;est parti{firstName ? `, ${firstName}` : ''} ! 🎉</p>
              <p className="mt-1 text-sm text-white/70">Bienvenue sur BomaVibes</p>
            </motion.div>
          ) : (
            <motion.p
              key={messageIndex}
              className="text-lg font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {MESSAGES[messageIndex]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {!done && (
        <div className="relative mt-2 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-pink-300"
              animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default ProfileLaunchOverlay
