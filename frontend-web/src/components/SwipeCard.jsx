import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Check, Info, MapPin, Target } from 'lucide-react'

const SWIPE_THRESHOLD = 100
const EXIT_X = 600

function avatarFor(profile) {
  return (
    profile.photos?.[0] ||
    `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`
  )
}

function SwipeCard({ profile, isTop, stackIndex, exitDirection, onSwipe, onExited, onOpenDetail }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-20, 20])
  const likeOpacity = useTransform(x, [20, 120], [0, 1])
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0])

  function handleDragEnd(_, info) {
    if (info.offset.x > SWIPE_THRESHOLD) onSwipe('like')
    else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe('pass')
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
        opacity: stackIndex > 2 ? 0 : 1,
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
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onAnimationComplete={() => {
        if (exitDirection) onExited()
      }}
      onClick={() => {
        if (Math.abs(x.get()) < 5) onOpenDetail()
      }}
      className="absolute inset-0"
    >
      <div className="relative h-full w-full cursor-grab overflow-hidden rounded-[28px] shadow-xl active:cursor-grabbing">
        <img
          src={avatarFor(profile)}
          alt={profile.firstName}
          draggable={false}
          className="h-full w-full select-none object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

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
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="Voir le profil complet"
        >
          <Info size={16} />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-5">
          {profile.datingGoal && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 text-[11px] font-semibold text-[#2B1D14]">
              <Target size={11} strokeWidth={2.5} />
              {profile.datingGoal}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-2xl font-bold text-white">
              {profile.firstName}, {profile.age}
            </h2>
            {profile.verified && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
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
          {profile.interests?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 3).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default SwipeCard
