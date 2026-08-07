import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Flag,
  Heart,
  Languages,
  Leaf,
  MapPin,
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
    <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-600">
      {Icon && <Icon size={10} strokeWidth={2} />}
      {label}
    </span>
  )
}

// Generic, reusable chip-list block — add a new profile attribute later by
// adding one more <InfoSection> call, no structural changes needed.
function InfoSection({ icon: Icon, title, items, iconFor }) {
  if (!items?.length) return null
  return (
    <div className="mt-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
        <Icon size={12} strokeWidth={2.25} />
        {title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip key={item} Icon={iconFor?.(item)} label={item} />
        ))}
      </div>
    </div>
  )
}

function ProfileDetailModal({ profile, matchPercent, onClose, onLike, onSuperlike, onPass, onBlocked }) {
  const { user } = useAuth()
  const { showToast } = useToast()
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
        className="glass-panel flex max-h-[92svh] w-full max-w-md flex-col overflow-visible rounded-t-[28px] md:max-h-[85svh] md:rounded-[28px]"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-[28px] md:rounded-t-[28px]">
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
            className="absolute left-3 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="absolute right-3 top-6">
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label="Plus d'options"
            >
              <MoreVertical size={16} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-surface-tint"
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

          <div className="absolute inset-x-0 bottom-0 p-4">
            {profile.datingGoal && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 text-[11px] font-semibold text-[#2B1D14]">
                <Target size={11} strokeWidth={2.5} />
                {profile.datingGoal}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-xl font-semibold text-white">
                {profile.firstName}, {profile.age}
              </h2>
              {profile.verified && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </div>
            {profile.city && (
              <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-white/70">
                <MapPin size={11} strokeWidth={2.5} />
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </p>
            )}
          </div>
        </div>

        {matchPercent != null && (
          <div className="relative z-10 flex justify-center">
            <span className="absolute -top-3.5 flex items-center gap-1 rounded-full border border-violet-400 bg-white dark:bg-surface-tint px-3 py-1 text-xs font-bold text-violet-600 shadow-md">
              <Star size={11} strokeWidth={2.5} fill="currentColor" />
              {matchPercent}% Match
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 pt-6">
          {profile.bio && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">À propos</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{profile.bio}</p>
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

        <div className="flex items-center justify-center gap-5 border-t border-ink/8 p-4">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onPass()
              onClose()
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-coral-500 shadow-lg shadow-black/10 dark:bg-surface-tint"
            aria-label="Passer"
          >
            <X size={20} strokeWidth={2.5} />
          </motion.button>
          {onSuperlike && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                onSuperlike()
                onClose()
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-violet-600 shadow-lg shadow-black/10 dark:bg-surface-tint"
              aria-label="Super like"
            >
              <Star size={20} strokeWidth={2.5} fill="currentColor" />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onLike()
              onClose()
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-500 text-white shadow-xl shadow-coral-500/40"
            aria-label="Aimer"
          >
            <Heart size={26} strokeWidth={2.5} fill="currentColor" />
          </motion.button>
        </div>
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
