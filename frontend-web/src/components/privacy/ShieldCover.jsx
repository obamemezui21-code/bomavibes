import { Lock } from 'lucide-react'
import useScreenShield from './useScreenShield.js'

// Blurs what's under it while the app is in the background or out of focus
// (useScreenShield). Place it inside a positioned parent.
function ShieldCover({ className = '' }) {
  const shielded = useScreenShield()
  if (!shielded) return null
  return (
    <div
      className={`absolute inset-0 z-[6] flex flex-col items-center justify-center gap-2 bg-violet-950/40 text-center text-white backdrop-blur-2xl ${className}`}
      role="status"
    >
      <Lock size={22} strokeWidth={2} aria-hidden="true" />
      <p className="px-6 text-sm font-semibold">Contenu masqué</p>
      <p className="px-6 text-xs text-white/75">Revenez sur BomaVibes pour l’afficher.</p>
    </div>
  )
}

export default ShieldCover
