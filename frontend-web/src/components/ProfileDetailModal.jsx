import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Baby,
  Briefcase,
  Check,
  Cigarette,
  CigaretteOff,
  Dumbbell,
  Flag,
  Flame,
  HandHeart,
  Heart,
  House,
  Languages,
  Lock,
  MapPin,
  MessageCircle,
  MessageCircleHeart,
  MoreVertical,
  Navigation,
  Plane,
  Rocket,
  Ruler,
  ShieldOff,
  Sparkles,
  Star,
  Wine,
  X,
} from 'lucide-react'
import InterestCard from './InterestCard.jsx'
import { distanceKmBetween } from '../lib/nearby.js'
import { activeStreakBadge } from '../lib/ngori.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import ReportModal from './ReportModal.jsx'
import BlockConfirmModal from './BlockConfirmModal.jsx'
import ComplimentModal from './ComplimentModal.jsx'
import VoicePromptPlayer from './VoicePromptPlayer.jsx'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import { ageSuffix } from '../lib/profileDisplay.js'
import { complimentAbout } from '../lib/compliments.js'
import Watermark from './privacy/Watermark.jsx'
import ShieldCover from './privacy/ShieldCover.jsx'
import { PROTECT_PROPS } from './privacy/protect.js'

// Small round button on a bio / prompt card: compliment that answer.
function ComplimentButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-pink-500 shadow-md ring-1 ring-ink/8 transition hover:scale-105 dark:bg-surface-tint"
      aria-label="Envoyer un compliment sur cette réponse"
      title="Envoyer un compliment"
    >
      <MessageCircleHeart size={17} strokeWidth={2.25} />
    </button>
  )
}

// Soft grey pill with a line icon — every profile fact uses this one look.
function InfoChip({ Icon, label, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 rounded-full bg-ink/[0.06] px-3.5 py-2 text-sm font-semibold text-ink"
    >
      {Icon && <Icon size={16} strokeWidth={2.25} className="shrink-0" />}
      {label}
    </span>
  )
}

function InfoBlock({ title, chips }) {
  if (!chips.length) return null
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-ink-soft">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <InfoChip key={`${chip.title}-${chip.label}`} {...chip} />
        ))}
      </div>
    </div>
  )
}

function formatDistance(km) {
  if (km == null) return null
  if (km < 5) return 'Dans votre ville'
  return `À ${km < 100 ? Math.round(km) : Math.round(km / 10) * 10} km`
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
              <stop offset="0%" stopColor="#ead5ea" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
        </svg>
        <span className="relative text-[11px] font-bold">{percent}%</span>
      </span>
      <span className="text-sm font-semibold">Match</span>
    </span>
  )
}

function ProfileDetailModal({
  profile,
  matchPercent,
  onClose,
  onLike,
  onSuperlike,
  onPass,
  onCompliment,
  onBlocked,
  matchId,
  isSelf,
}) {
  const { user, publicProfile } = useAuth()
  const { refreshBlockedIds } = useConversations()
  const { requireIdentity } = useIdentity()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const photos = profile.photos?.length
    ? profile.photos
    : [fallbackAvatar(profile.firstName || profile.id, 'f3e8ff,fce7f3,ede9fe')]
  const [index, setIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // undefined = closed, null = general compliment, string = the quoted answer
  const [complimenting, setComplimenting] = useState(undefined)

  async function handleReport(reason, description, alsoBlock) {
    setIsSubmitting(true)
    try {
      await reportUser(user.id, profile.id, reason, description)
      if (alsoBlock) {
        await blockUser(user.id, profile.id)
        refreshBlockedIds()
      }
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
      refreshBlockedIds()
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
  const canCompliment = showActions && !matchId && !!onCompliment
  // Liking needs a verified identity: ask before the member writes anything.
  function startCompliment(about) {
    if (requireIdentity()) setComplimenting(about)
  }
  const [streakBadge] = useState(() => activeStreakBadge(profile))

  const work = [profile.jobTitle, profile.workplace].filter(Boolean).join(' chez ')
  const home = [profile.neighborhood, profile.city].filter(Boolean).join(', ')
  const lifestyle = profile.lifestyle || {}
  const infoChips = [
    { Icon: Heart, title: 'Recherche', label: profile.datingGoal },
    !isSelf && !profile.hideDistance && { Icon: Navigation, title: 'Distance', label: formatDistance(distanceKmBetween(publicProfile, profile)) },
    { Icon: Baby, title: 'Enfants', label: profile.children },
    { Icon: lifestyle.smoking === 'Non-fumeur' ? CigaretteOff : Cigarette, title: 'Tabac', label: lifestyle.smoking },
    { Icon: Wine, title: 'Alcool', label: lifestyle.alcohol },
    { Icon: Dumbbell, title: 'Sport', label: lifestyle.sport },
    { Icon: Plane, title: 'Voyage', label: lifestyle.travel },
    ...(profile.languages || []).map((language) => ({ Icon: Languages, title: 'Langue', label: language })),
    { Icon: Ruler, title: 'Taille', label: profile.height ? `${profile.height} cm` : null },
    { Icon: HandHeart, title: 'Religion', label: profile.religion },
    { Icon: Briefcase, title: 'Travail', label: work },
    { Icon: House, title: 'Habite à', label: home },
    profile.isEntrepreneur && { Icon: Rocket, title: 'Entrepreneuriat', label: 'Entrepreneur·e' },
    profile.isTraveling && { Icon: Plane, title: 'En voyage', label: 'Actuellement en voyage' },
  ].filter((chip) => chip && chip.label)
  const personalityChips = (profile.personalityTraits || []).map((trait) => ({
    Icon: Sparkles,
    title: 'Personnalité',
    label: trait,
  }))

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
          <div {...PROTECT_PROPS} className="protected-media relative h-[64svh] w-full shrink-0 md:h-[58%]">
            <img src={photos[index]} alt={profile.firstName} draggable={false} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/35" />
            {!isSelf && <Watermark />}
            {!isSelf && <ShieldCover />}

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
                  {ageSuffix(profile)}
                </h2>
                {profile.verified && (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white"
                    title="Profil vérifié par BomaVibes"
                    aria-label="Profil vérifié"
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              {(profile.verified || streakBadge) && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {profile.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      <Check size={11} strokeWidth={3} />
                      Profil vérifié par selfie
                    </span>
                  )}
                  {streakBadge && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md"
                      title="Connecté·e à BomaVibes plusieurs jours d'affilée"
                    >
                      <Flame size={11} strokeWidth={2.5} />
                      {streakBadge} jours d'affilée
                    </span>
                  )}
                </div>
              )}
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

            {profile.bio && (
              <div className={`relative mt-5 ${canCompliment ? 'pb-10' : ''}`}>
                <p className="text-sm font-semibold text-ink-soft">À propos de moi</p>
                <p className="mt-2 whitespace-pre-line text-lg font-semibold leading-snug text-ink">{profile.bio}</p>
                {canCompliment && (
                  <ComplimentButton onClick={() => startCompliment(complimentAbout(null, profile.bio))} />
                )}
              </div>
            )}

            {profile.prompts?.length > 0 && (
              <div className="mt-5 space-y-3">
                {profile.prompts.map((p) => (
                  <div key={p.question} className={`relative rounded-2xl bg-ink/[0.04] p-4 ${canCompliment ? 'pb-12' : ''}`}>
                    <p className="text-sm font-semibold text-ink-soft">{p.question}</p>
                    <p className="mt-1.5 whitespace-pre-line text-lg font-semibold leading-snug text-ink">{p.answer}</p>
                    {canCompliment && (
                      <ComplimentButton onClick={() => startCompliment(complimentAbout(p.question, p.answer))} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {profile.voicePrompt?.url && (
              <div className="mt-3">
                <VoicePromptPlayer voicePrompt={profile.voicePrompt}>
                  {canCompliment && (
                    <ComplimentButton
                      onClick={() => startCompliment(complimentAbout(profile.voicePrompt.question, '🎤 Note vocale'))}
                    />
                  )}
                </VoicePromptPlayer>
              </div>
            )}

            <InfoBlock title={isSelf ? 'Mes infos' : 'Ses infos'} chips={infoChips} />
            <InfoBlock title="Personnalité" chips={personalityChips} />

            {profile.interests?.length > 0 && (
              <div className="mt-6">
                <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
                  <Heart size={14} strokeWidth={2.25} className="text-pink-500" />
                  Centres d'intérêt
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {profile.interests.map((interest) => (
                    <InterestCard
                      key={interest}
                      interest={interest}
                      subtitle={
                        profile.id !== user?.id && publicProfile?.interests?.includes(interest) ? '💜 En commun' : null
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {!isSelf && (
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-soft/60">
                <Lock size={11} aria-hidden="true" /> Photos privées : capture et partage interdits.
              </p>
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
                {canCompliment && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    onClick={() => startCompliment(null)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-pink-500 shadow-lg shadow-black/15 ring-1 ring-ink/8 dark:bg-surface-tint"
                    aria-label="Envoyer un compliment"
                  >
                    <MessageCircleHeart size={24} strokeWidth={2.25} />
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => {
                    onLike()
                    onClose()
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-heart-400 to-heart-500 text-white shadow-lg shadow-heart-500/40"
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
      {/* Clicks inside the compliment modal must not close the profile behind it. */}
      <AnimatePresence>
        {complimenting !== undefined && (
          <div onClick={(e) => e.stopPropagation()}>
          <ComplimentModal
            firstName={profile.firstName}
            about={complimenting}
            onCancel={() => setComplimenting(undefined)}
            onSend={(compliment) => {
              setComplimenting(undefined)
              onCompliment(compliment)
              onClose()
            }}
          />
          </div>
        )}
      </AnimatePresence>
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
