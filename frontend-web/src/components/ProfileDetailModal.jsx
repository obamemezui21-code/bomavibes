import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Heart, X } from 'lucide-react'

function ProfileDetailModal({ profile, onClose, onLike, onPass }) {
  const photos = profile.photos?.length ? profile.photos : [profile.photo]
  const [index, setIndex] = useState(0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] md:max-h-[85svh] md:rounded-[28px]"
      >
        <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden">
          <img src={photos[index]} alt={profile.firstName} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

          {photos.length > 1 && (
            <div className="absolute inset-x-3 top-3 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1 flex-1 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/30'}`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-7 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-semibold text-white">
                {profile.firstName}, {profile.age}
              </h2>
              {profile.verified && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </div>
            {profile.city && (
              <p className="text-sm text-white/70">
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-ink">{profile.bio}</p>

          {profile.interests?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {profile.prompts?.length > 0 && (
            <div className="mt-5 space-y-3">
              {profile.prompts.map((p) => (
                <div key={p.question} className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">{p.question}</p>
                  <p className="mt-1.5 text-sm text-ink">{p.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 border-t border-ink/8 p-4">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onPass()
              onClose()
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-coral-500 shadow-lg"
            aria-label="Passer"
          >
            <X size={26} strokeWidth={2.5} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onLike()
              onClose()
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-mint-500 shadow-lg"
            aria-label="Aimer"
          >
            <Heart size={26} strokeWidth={2.5} fill="currentColor" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ProfileDetailModal
