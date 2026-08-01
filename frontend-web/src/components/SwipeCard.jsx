import { forwardRef, useImperativeHandle, useState } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'

const EXIT_DISTANCE = 900

const EXIT_TARGETS = {
  like: { x: EXIT_DISTANCE, y: -80, rotate: 24 },
  pass: { x: -EXIT_DISTANCE, y: -80, rotate: -24 },
  superlike: { x: 0, y: -EXIT_DISTANCE, rotate: 0 },
}

const SwipeCard = forwardRef(function SwipeCard({ profile, active, onExit, onExpand, onReport, onBlock }, ref) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-320, 320], [-18, 18])
  const likeOpacity = useTransform(x, [30, 140], [0, 1])
  const passOpacity = useTransform(x, [-140, -30], [1, 0])
  const superOpacity = useTransform(y, [-140, -30], [1, 0])
  const controls = useAnimation()

  const photos = profile.photos?.length ? profile.photos : [profile.photo]
  const [photoIndex, setPhotoIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  async function fly(direction) {
    await controls.start({
      ...EXIT_TARGETS[direction],
      opacity: 0.4,
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    })
    onExit(direction)
  }

  useImperativeHandle(ref, () => ({ fly }))

  function handleDragEnd(_, info) {
    const { offset, velocity } = info

    if (offset.y < -110 && Math.abs(offset.y) > Math.abs(offset.x)) {
      fly('superlike')
    } else if (offset.x > 110 || velocity.x > 500) {
      fly('like')
    } else if (offset.x < -110 || velocity.x < -500) {
      fly('pass')
    } else {
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 380, damping: 26 } })
    }
  }

  function changePhoto(e, delta) {
    e.stopPropagation()
    setPhotoIndex((i) => Math.min(Math.max(i + delta, 0), photos.length - 1))
  }

  return (
    <motion.div
      style={{ x, y, rotate }}
      drag={active}
      dragElastic={0.65}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={active ? handleDragEnd : undefined}
      animate={controls}
      whileDrag={{ cursor: 'grabbing' }}
      className={`absolute inset-0 touch-none select-none overflow-hidden rounded-[28px] bg-surface-soft shadow-[0_30px_60px_-20px_rgba(139,92,246,0.35)] ring-1 ring-black/5 ${
        active ? 'cursor-grab' : ''
      }`}
    >
      <img
        src={photos[photoIndex]}
        alt={profile.firstName}
        className="h-full w-full object-cover"
        draggable={false}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      {active && photos.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i === photoIndex ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}

      {active && photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => changePhoto(e, -1)}
            className="absolute inset-y-0 left-0 w-1/2"
            aria-label="Photo précédente"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={(e) => changePhoto(e, 1)}
            className="absolute inset-y-0 right-0 w-1/2"
            aria-label="Photo suivante"
            tabIndex={-1}
          />
        </>
      )}

      {active && (
        <div className="absolute right-3 top-7 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur-sm"
            aria-label="Options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 w-40 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onReport?.(profile)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-ink/5"
              >
                Signaler
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onBlock?.(profile)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-coral-500 hover:bg-ink/5"
              >
                Bloquer
              </button>
            </div>
          )}
        </div>
      )}

      {active && (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute left-6 top-16 rotate-[-14deg] rounded-xl border-4 border-mint-500 bg-black/40 px-4 py-1.5 text-2xl font-extrabold uppercase tracking-wide text-mint-500 backdrop-blur-sm"
          >
            Like
          </motion.div>
          <motion.div
            style={{ opacity: passOpacity }}
            className="absolute right-6 top-16 rotate-[14deg] rounded-xl border-4 border-coral-500 bg-black/40 px-4 py-1.5 text-2xl font-extrabold uppercase tracking-wide text-coral-500 backdrop-blur-sm"
          >
            Nope
          </motion.div>
          <motion.div
            style={{ opacity: superOpacity }}
            className="absolute left-1/2 top-16 -translate-x-1/2 rounded-xl border-4 border-violet-400 bg-black/40 px-4 py-1.5 text-2xl font-extrabold uppercase tracking-wide text-violet-600 backdrop-blur-sm"
          >
            Super
          </motion.div>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-14 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-semibold">
                {profile.firstName}, {profile.age}
              </h2>
              {profile.verified && (
                <span
                  title="Profil vérifié"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[11px] text-white"
                >
                  ✓
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">
              {profile.city} · {profile.distanceKm} km
            </p>
            <p className="mt-2 text-sm text-white/90">{profile.bio}</p>
            {profile.interests?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          {active && onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onExpand(profile)
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg text-white backdrop-blur-sm transition hover:bg-white/25"
              aria-label="Voir le profil complet"
            >
              ⌃
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
})

export default SwipeCard
