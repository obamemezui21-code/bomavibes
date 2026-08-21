import { useState } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Check, Info, MapPin, Target } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'

const SWIPE_THRESHOLD = 100
const EXIT_X = 600
const EXIT_TRANSITION = { type: 'tween', duration: 0.22, ease: 'easeIn' }
const STACK_TRANSITION = { type: 'spring', stiffness: 500, damping: 32 }
const FALLBACK_AVATAR_SEED = (profile) =>
  `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`

// Each interest/trait badge gets its own tint from this rotation so the
// tag row reads as varied instead of one flat color block. Full literal
// class strings (not built from a variable) so Tailwind's build actually
// generates them. Picked deterministically from the label so the same tag
// always gets the same color across cards/re-renders.
const BADGE_TINTS = [
  'border-violet-300/40 bg-violet-500/30',
  'border-pink-300/40 bg-pink-500/30',
  'border-coral-300/40 bg-coral-500/30',
  'border-mint-300/40 bg-mint-500/30',
  'border-sky-300/40 bg-sky-500/30',
]

function tintForTag(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return BADGE_TINTS[hash % BADGE_TINTS.length]
}

function avatarFor(profile, index) {
  return photoVariant(profile.photos?.[index], 'medium') || FALLBACK_AVATAR_SEED(profile)
}

function fullPhotoFor(profile, index) {
  return profile.photos?.[index] || FALLBACK_AVATAR_SEED(profile)
}

function SwipeCard({ profile, isTop, stackIndex, exitDirection, onSwipe, onExited, onOpenDetail }) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photoCount = profile.photos?.length || 1
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-20, 20])
  const likeOpacity = useTransform(x, [20, 120], [0, 1])
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0])

  function handleDragEnd(_, info) {
    if (info.offset.x > SWIPE_THRESHOLD) onSwipe('like')
    else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe('pass')
  }

  function handlePhotoZoneClick(e) {
    if (photoCount <= 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const tappedRight = e.clientX - rect.left > rect.width / 2
    setPhotoIndex((i) => {
      if (tappedRight) return Math.min(i + 1, photoCount - 1)
      return Math.max(i - 1, 0)
    })
  }

  const animate = exitDirection
    ? {
        x: exitDirection === 'pass' ? -EXIT_X : EXIT_X,
        rotate: exitDirection === 'pass' ? -20 : 20,
        opacity: 0,
      }
    : {
        scale: 1 - stackIndex * 0.04,
        y: stackIndex * 14,
        rotate: stackIndex * 3,
        // Only the top card is visible — no peeking stack behind it.
        opacity: stackIndex === 0 ? 1 : 0,
      }

  const draggable = isTop && !exitDirection

  return (
    <motion.div
      drag={draggable ? 'x' : false}
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{
        x: draggable ? x : undefined,
        rotate: draggable ? rotate : undefined,
        zIndex: 10 - stackIndex,
      }}
      animate={animate}
      transition={exitDirection ? EXIT_TRANSITION : STACK_TRANSITION}
      onAnimationComplete={() => {
        if (exitDirection) onExited()
      }}
      className="absolute inset-0"
    >
      {/* Shadow lives on this outer box; overflow-hidden (for the rounded
          image/content) is on a separate inner wrapper — an element's own
          overflow-hidden clips its own box-shadow, so combining both on one
          div was silently hiding the "lifted off the background" shadow. */}
      <div className="relative h-full w-full cursor-grab rounded-[28px] shadow-xl active:cursor-grabbing">
        <div className="relative h-full w-full overflow-hidden rounded-[28px]">
          <img
            src={avatarFor(profile, photoIndex)}
            onError={fallbackToFullPhoto(fullPhotoFor(profile, photoIndex))}
            alt={profile.firstName}
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
          <div
            onClick={(e) => {
              if (Math.abs(x.get()) < 5) handlePhotoZoneClick(e)
            }}
            className="absolute inset-0"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {photoCount > 1 && (
            <div className="pointer-events-none absolute inset-x-3 top-3 flex gap-1">
              {Array.from({ length: photoCount }).map((_, i) => (
                <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full rounded-full bg-white transition-all duration-200"
                    style={{ width: i <= photoIndex ? '100%' : '0%' }}
                  />
                </span>
              ))}
            </div>
          )}

          {isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute left-6 top-8 rotate-[-12deg] rounded-lg border-4 border-mint-500 px-3 py-1 text-xl font-black uppercase tracking-wide text-mint-500"
              >
                Like
              </motion.div>
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute right-6 top-8 rotate-[12deg] rounded-lg border-4 border-coral-500 px-3 py-1 text-xl font-black uppercase tracking-wide text-coral-500"
              >
                Nope
              </motion.div>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetail()
            }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label="Voir le profil complet"
          >
            <Info size={16} />
          </button>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-10 pt-5">
            {(profile.datingGoal || profile.isEntrepreneur) && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {profile.datingGoal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    <Target size={11} strokeWidth={2.5} />
                    {profile.datingGoal}
                  </span>
                )}
                {profile.isEntrepreneur && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    🚀 Entrepreneur·e
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-2xl font-bold text-white">
                {profile.firstName}, {profile.age}
              </h2>
              {profile.verified && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </div>
            {profile.city && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
                <MapPin size={12} strokeWidth={2.5} />
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </p>
            )}
            {(profile.interests?.length > 0 || profile.personalityTraits?.length > 0) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {profile.interests?.slice(0, 3).map((interest) => (
                  <span
                    key={interest}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm ${tintForTag(interest)}`}
                  >
                    {interest}
                  </span>
                ))}
                {profile.personalityTraits?.slice(0, 2).map((trait) => (
                  <span
                    key={trait}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm ${tintForTag(trait)}`}
                  >
                    ✨ {trait}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SwipeCard
