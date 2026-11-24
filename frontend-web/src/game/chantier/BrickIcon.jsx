import { useEffect, useRef } from 'react'
import { paintBrick } from './bricks.js'

// One brick as a small picture, the same drawing as in the game.
export function BrickIcon({ material, size = 20, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = px
    canvas.height = px
    const g = canvas.getContext('2d')
    g.scale(px / 100, px / 100)
    paintBrick(g, material)
  }, [material, size])
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}

// The wheelbarrow that takes a load away.
export function BarrowIcon({ size = 20, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8h16l-4 6.5h-8z" fill="currentColor" />
      <path d="M1.5 5.5h2.2L6 8M10.5 15 8 20M14.5 15l2 2.5" />
      <circle cx="17.5" cy="19" r="2.6" />
    </svg>
  )
}

// A whole load (the next one, in the HUD), as it will come under the crane.
export function LoadIcon({ load, size = 15 }) {
  if (!load) return null
  const minX = Math.min(...load.cells.map((c) => c[0]))
  const minY = Math.min(...load.cells.map((c) => c[1]))
  const cols = Math.max(...load.cells.map((c) => c[0])) - minX + 1
  const rows = Math.max(...load.cells.map((c) => c[1])) - minY + 1
  return (
    <span className="relative block" style={{ width: cols * size, height: rows * size }}>
      {load.cells.map(([x, y], i) => (
        <span key={i} className="absolute" style={{ left: (x - minX) * size, top: (y - minY) * size }}>
          <BrickIcon material={load.mats[i]} size={size} className="block" />
        </span>
      ))}
    </span>
  )
}
