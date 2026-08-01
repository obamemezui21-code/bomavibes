import { motion } from 'framer-motion'

const COLORS = ['#8B5CF6', '#EC4899', '#F472B6', '#A78BFA', '#10B981']
const PIECES = Array.from({ length: 26 }, (_, i) => i)

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((i) => {
        const angle = (i / PIECES.length) * Math.PI * 2 + Math.random() * 0.4
        const distance = 110 + Math.random() * 150
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance - 30
        const color = COLORS[i % COLORS.length]
        const width = 5 + Math.random() * 5
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x, y, opacity: 0, rotate: Math.random() * 360 }}
            transition={{ duration: 1 + Math.random() * 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '32%',
              width,
              height: width * 0.4,
              backgroundColor: color,
              borderRadius: 2,
            }}
          />
        )
      })}
    </div>
  )
}

export default Confetti
