import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Heart } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'

const NEW_PROFILE_MS = 7 * 24 * 60 * 60 * 1000

function photoFor(profile) {
  return (
    photoVariant(profile.photos?.[0], 'medium') ||
    fallbackAvatar(profile.firstName || profile.id, 'f3e8ff,fce7f3,ede9fe')
  )
}

// Portrait card for the Discover carousel ("Cartes" mode, Friendzy-style):
// photo, NEW / % badges on top, name, age and city at the bottom. Tapping it
// opens the full profile, where like / pass / super like live.
function DiscoverProfileCard({ profile, matchPercent, index = 0, onOpen }) {
  const [isNew] = useState(() => !!profile.createdAtMs && Date.now() - profile.createdAtMs < NEW_PROFILE_MS)

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: Math.min(index, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="group relative aspect-[3/4] w-40 shrink-0 snap-start overflow-hidden rounded-3xl text-left shadow-[0_14px_30px_-12px_rgba(0,0,0,0.45)]"
    >
      <img
        src={photoFor(profile)}
        onError={profile.photos?.[0] ? fallbackToFullPhoto(profile.photos[0]) : undefined}
        alt={profile.firstName}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        {isNew ? (
          <span className="rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            Nouveau
          </span>
        ) : (
          <span />
        )}
        {matchPercent > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            <Heart size={9} strokeWidth={3} fill="currentColor" className="text-heart-400" />
            {matchPercent}%
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="flex items-center gap-1 truncate font-display text-sm font-semibold text-white">
          <span className="truncate">
            {profile.firstName}
            {profile.age ? `, ${profile.age}` : ''}
          </span>
          {profile.verified && (
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500">
              <Check size={8} strokeWidth={3.5} />
            </span>
          )}
        </p>
        {profile.city && (
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/70">
            {profile.city}
          </p>
        )}
      </div>
    </motion.button>
  )
}

export default DiscoverProfileCard
