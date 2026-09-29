import { useState } from 'react'
import { motion } from 'framer-motion'

const COLORS = ['#4b164c', '#8a4d8b', '#ffffff', '#ead5ea', '#dd88cf']
const PIECE_COUNT = 26

// Random trajectories are drawn once per burst (at mount), not on every
// render — otherwise any re-render mid-animation retargets every piece.
function makePieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const angle = (i / PIECE_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const distance = 110 + Math.random() * 150
    const width = 5 + Math.random() * 5
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30,
      rotate: Math.random() * 360,
      duration: 1 + Math.random() * 0.5,
      width,
      color: COLORS[i % COLORS.length],
    }
  })
}

function Confetti() {
  const [pieces] = useState(makePieces)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '32%',
            width: p.width,
            height: p.width * 0.4,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}

export default Confetti
