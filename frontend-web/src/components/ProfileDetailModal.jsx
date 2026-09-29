import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Flag,
  Heart,
  Languages,
  Leaf,
  MapPin,
  MessageCircle,
  MoreVertical,
  ShieldOff,
  Sparkles,
  Star,
  Target,
  X,
} from 'lucide-react'
import { iconForInterest } from '../lib/interests.js'
import { LIFESTYLE_GROUPS } from '../lib/onboardingOptions.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import ReportModal from './ReportModal.jsx'
import BlockConfirmModal from './BlockConfirmModal.jsx'

function Chip({ Icon, label }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 py-1.5 text-xs font-medium text-ink dark:bg-surface-tint">
      {Icon && <Icon size={13} strokeWidth={2.25} className="text-violet-500" />}
      {label}
    </span>
  )
}

// Generic, reusable chip-list block — add a new profile attribute later by
// adding one more <InfoSection> call, no structural changes needed.
function InfoSection({ icon: Icon, title, items, iconFor }) {
  if (!items?.length) return null
  return (
    <div className="mt-6">
      <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
        <Icon size={14} strokeWidth={2.25} className="text-pink-500" />
        {title}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <Chip key={item} Icon={iconFor?.(item)} label={item} />
        ))}
      </div>
    </div>
  )
}

const RING_RADIUS = 17
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// "80% Match" pill with a circular progress ring, as on the Friendzy profile.
function MatchRing({ percent }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-3.5 text-white backdrop-blur-md">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
          <circle cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
          <motion.circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            stroke="url(#match-ring-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - percent / 100) }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <defs>
            <linearGradient id="match-ring-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c9a0f0" />
              <stop offset="100%" stopColor="#ef8fc7" />
            </linearGradient>
          </defs>
        </svg>
        <span className="relative text-[11px] font-bold">{percent}%</span>
      </span>
      <span className="text-sm font-semibold">Match</span>
    </span>
  )
}

function ProfileDetailModal({ profile, matchPercent, onClose, onLike, onSuperlike, onPass, onBlocked, matchId, isSelf }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const photos = profile.photos?.length
    ? profile.photos
    : [`https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`]
  const [index, setIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleReport(reason, description, alsoBlock) {
    setIsSubmitting(true)
    try {
      await reportUser(user.id, profile.id, reason, description)
      if (alsoBlock) await blockUser(user.id, profile.id)
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setShowReport(false)
      if (alsoBlock) {
        onBlocked?.(profile)
        onClose()
      }
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBlock() {
    setIsSubmitting(true)
    try {
      await blockUser(user.id, profile.id)
      showToast(`Vous avez bloqué ${profile.firstName}.`, 'info')
      setShowBlock(false)
      onBlocked?.(profile)
      onClose()
    } catch {
      showToast('Impossible de bloquer ce profil, réessayez.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showActions = !isSelf

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Full screen on phones; a tall rounded card on wider screens. */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full overflow-hidden bg-surface md:h-[88svh] md:max-w-md md:rounded-[32px] md:shadow-2xl"
      >
        <div className="h-full overflow-y-auto overscroll-contain">
          {/* Photo — takes most of the screen, the details sheet slides over its bottom edge */}
          <div className="relative h-[64svh] w-full shrink-0 md:h-[58%]">
            <img src={photos[index]} alt={profile.firstName} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/35" />

            {photos.length > 1 && (
              <>
                {/* Tap the left / right half to go through the photos */}
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                  className="absolute inset-y-0 left-0 w-1/2"
                  aria-label="Photo précédente"
                />
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(i + 1, photos.length - 1))}
                  className="absolute inset-y-0 right-0 w-1/2"
                  aria-label="Photo suivante"
                />
                <div className="pointer-events-none absolute inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] flex gap-1.5">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/35'}`}
                    />
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="absolute left-4 top-[calc(max(0.75rem,env(safe-area-inset-top))+0.75rem)] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
              aria-label="Retour"
            >
              <ArrowLeft size={18} />
            </button>

            {!isSelf && (
              <div className="absolute right-4 top-[calc(max(0.75rem,env(safe-area-inset-top))+0.75rem)]">
                <button
                  type="button"
                  onClick={() => setShowMenu((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
                  aria-label="Plus d'options"
                >
                  <MoreVertical size={18} />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 z-10 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-surface-tint"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false)
                          setShowReport(true)
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                      >
                        <Flag size={14} strokeWidth={2.25} />
                        Signaler
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false)
                          setShowBlock(true)
                        }}
                        className="flex w-full items-center gap-2 border-t border-ink/6 px-3.5 py-2.5 text-left text-sm font-medium text-coral-500 hover:bg-coral-500/5"
                      >
                        <ShieldOff size={14} strokeWidth={2.25} />
                        Bloquer
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-12 text-center">
              {profile.city && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                  <MapPin size={11} strokeWidth={2.5} />
                  {profile.city}
                  {profile.country ? `, ${profile.country}` : ''}
                </span>
              )}
              <div className="mt-2 flex items-center gap-2">
                <h2 className="font-display text-3xl font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
                  {profile.firstName}
                  {profile.age ? `, ${profile.age}` : ''}
                </h2>
                {profile.verified && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              {matchPercent > 0 && (
                <div className="mt-3">
                  <MatchRing percent={matchPercent} />
                </div>
              )}
            </div>
          </div>

          {/* Details sheet */}
          <div className={`relative -mt-8 min-h-[45%] rounded-t-[32px] bg-surface px-5 pt-3 ${showActions ? 'pb-32' : 'pb-8'}`}>
            <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/12" />

            {(profile.datingGoal || profile.isEntrepreneur) && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {profile.datingGoal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-ink-on-brand">
                    <Target size={12} strokeWidth={2.5} />
                    {profile.datingGoal}
                  </span>
                )}
                {profile.isEntrepreneur && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-600">
                    🚀 Entrepreneur·e
                  </span>
                )}
              </div>
            )}

            {profile.bio && (
              <div className="mt-5">
                <p className="font-display text-sm font-semibold text-ink">À propos</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
              </div>
            )}

            <InfoSection icon={Heart} title="Centres d'intérêt" items={profile.interests} iconFor={iconForInterest} />
            <InfoSection icon={Sparkles} title="Personnalité" items={profile.personalityTraits} />
            <InfoSection icon={Languages} title="Langues parlées" items={profile.languages} />
            <InfoSection
              icon={Leaf}
              title="Style de vie"
              items={LIFESTYLE_GROUPS.filter((g) => profile.lifestyle?.[g.key]).map(
                (g) => `${g.label} : ${profile.lifestyle[g.key]}`,
              )}
            />

            {profile.prompts?.length > 0 && (
              <div className="mt-6 space-y-3">
                {profile.prompts.map((p) => (
                  <div key={p.question} className="rounded-2xl bg-surface-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">{p.question}</p>
                    <p className="mt-1.5 text-sm text-ink">{p.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating round actions, pinned to the bottom over the sheet */}
        {showActions && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-surface via-surface/85 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
            {matchId ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onClose()
                  navigate(`/chat/${matchId}`)
                }}
                className="pointer-events-auto flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-8 py-3.5 text-sm font-semibold text-ink-on-brand shadow-xl shadow-violet-500/30"
              >
                <MessageCircle size={18} strokeWidth={2.25} />
                Envoyer un message
              </motion.button>
            ) : (
              <div className="pointer-events-auto flex items-center gap-5">
                <motion.button
                  whileTap={{ scale: 0.85, rotate: -8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => {
                    onPass()
                    onClose()
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-lg shadow-black/15 ring-1 ring-ink/8 dark:bg-surface-tint"
                  aria-label="Passer"
                >
                  <X size={24} strokeWidth={2.5} />
                </motion.button>
                {onSuperlike && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    onClick={() => {
                      onSuperlike()
                      onClose()
                    }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-950 text-white shadow-xl shadow-violet-950/40"
                    aria-label="Super like"
                  >
                    <Star size={26} strokeWidth={2.25} fill="currentColor" />
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => {
                    onLike()
                    onClose()
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-lg shadow-pink-500/40"
                  aria-label="Aimer"
                >
                  <Heart size={24} strokeWidth={2.5} fill="currentColor" />
                </motion.button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {showReport && (
        <ReportModal
          firstName={profile.firstName}
          onClose={() => setShowReport(false)}
          onSubmit={handleReport}
          isSubmitting={isSubmitting}
        />
      )}
      {showBlock && (
        <BlockConfirmModal
          firstName={profile.firstName}
          onCancel={() => setShowBlock(false)}
          onConfirm={handleBlock}
          isBlocking={isSubmitting}
        />
      )}
    </motion.div>
  )
}

export default ProfileDetailModal
