import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Flag, Heart, MoreVertical, ShieldOff, Star, X } from 'lucide-react'
import { iconForInterest } from '../lib/interests.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import ReportModal from './ReportModal.jsx'
import BlockConfirmModal from './BlockConfirmModal.jsx'

function ProfileDetailModal({ profile, matchPercent, onClose, onLike, onSuperlike, onPass, onBlocked }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const photos = profile.photos?.length ? profile.photos : [profile.photo]
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
        <div className="relative aspect-[4/4] w-full shrink-0 overflow-hidden rounded-t-[28px] md:rounded-t-[28px]">
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
            className="absolute left-3 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="absolute right-3 top-6">
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
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
                  className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5"
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
              <p className="text-xs uppercase tracking-wide text-white/70">
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

          {profile.interests?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">Centres d'intérêt</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.interests.map((interest) => {
                  const Icon = iconForInterest(interest)
                  return (
                    <span
                      key={interest}
                      className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-600"
                    >
                      <Icon size={10} strokeWidth={2} />
                      {interest}
                    </span>
                  )
                })}
              </div>
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

        <div className="flex items-center justify-center gap-4 border-t border-ink/8 p-3.5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onPass()
              onClose()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-surface-tint text-coral-500 shadow-md"
            aria-label="Passer"
          >
            <X size={19} strokeWidth={2.5} />
          </motion.button>
          {onSuperlike && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                onSuperlike()
                onClose()
              }}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/30"
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
            className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-500 text-white shadow-md"
            aria-label="Aimer"
          >
            <Heart size={19} strokeWidth={2.5} fill="currentColor" />
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
