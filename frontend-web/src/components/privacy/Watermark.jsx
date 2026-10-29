import { useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { TILE_H, TILE_W, watermarkLabel, watermarkTile } from '../../lib/watermark.js'

// The viewer's name, tiled over a photo or a conversation (lib/watermark.js).
// Place it inside a positioned parent; it never catches taps.
function Watermark({ className = '' }) {
  const { user, publicProfile } = useAuth()
  const label = watermarkLabel(publicProfile?.firstName || user?.firstName, user?.id)
  const tile = useMemo(() => watermarkTile(label), [label])
  if (!user) return null
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[4] select-none ${className}`}
      style={{ backgroundImage: tile, backgroundSize: `${TILE_W}px ${TILE_H}px` }}
    />
  )
}

export default Watermark
