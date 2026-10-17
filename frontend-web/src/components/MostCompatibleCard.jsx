import { motion } from 'framer-motion'
import { Check, ChevronRight, Sparkles } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import { ageSuffix } from '../lib/profileDisplay.js'

// Discover's daily pick (lib/mostCompatible.js): who fits the member best
// today, and why.
function MostCompatibleCard({ pick, onOpen }) {
  const { profile, reasons } = pick
  const photo = profile.photos?.[0]
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center gap-3.5 rounded-[24px] bg-gradient-to-r from-violet-600 to-pink-500 p-3.5 text-left text-white shadow-lg shadow-violet-500/25"
    >
      <span className="relative shrink-0">
        <img
          src={photoVariant(photo, 'medium') || photo || fallbackAvatar(profile.firstName || profile.id)}
          onError={photo ? fallbackToFullPhoto(photo) : undefined}
          alt={profile.firstName}
          className="h-16 w-16 rounded-full object-cover ring-2 ring-white/80"
        />
        {profile.verified && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 ring-2 ring-white">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/85">
          <Sparkles size={12} strokeWidth={2.5} />
          Le plus compatible du jour
        </span>
        <span className="mt-0.5 block truncate font-display text-lg font-semibold">
          {profile.firstName}
          {ageSuffix(profile)}
        </span>
        {reasons.length > 0 && (
          <span className="mt-0.5 block line-clamp-2 text-xs text-white/85">{reasons.slice(0, 2).join(' · ')}</span>
        )}
      </span>
      <ChevronRight size={20} strokeWidth={2.25} className="shrink-0 text-white/80" />
    </motion.button>
  )
}

export default MostCompatibleCard
