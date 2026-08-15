import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Heart, MessageCircle, MoreVertical, Pencil, Send, Sparkles, Trash2 } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'
import { useToast } from '../../context/ToastContext.jsx'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

// A handful of hearts flung outward from the like button on tap, each with
// its own random angle/distance/rotation/delay — a one-shot burst, not a
// looping effect, so it reads as a reaction to *this* like, not decoration.
const BURST_PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4
  const distance = 34 + Math.random() * 22
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 10,
    rotate: (Math.random() - 0.5) * 140,
    scale: 0.5 + Math.random() * 0.6,
    delay: Math.random() * 0.08,
  }
})

function LikeBurst({ burstId }) {
  return (
    <AnimatePresence>
      {burstId > 0 && (
        <span key={burstId} className="pointer-events-none absolute left-1/2 top-1/2">
          {BURST_PARTICLES.map((p) => (
            <motion.span
              key={p.id}
              className="absolute text-coral-500"
              initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
              animate={{ opacity: 0, scale: p.scale, x: p.x, y: p.y, rotate: p.rotate }}
              transition={{ duration: 0.7, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            >
              <Heart size={12} fill="currentColor" />
            </motion.span>
          ))}
        </span>
      )}
    </AnimatePresence>
  )
}

function PostCard({ post, author, isLiked, onToggleLike, onAuthorClick, onOpen, currentUserId, onDelete, onEdit, onReport, onShare }) {
  const [showMenu, setShowMenu] = useState(false)
  const [burstId, setBurstId] = useState(0)
  const { showToast } = useToast()
  const wasLikedRef = useRef(isLiked)
  const isOwn = post.authorId === currentUserId
  const fullPhoto = author?.photos?.[0]
  const avatarUrl = fullPhoto
    ? photoVariant(fullPhoto, 'thumb')
    : `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(author?.firstName || post.authorId)}&backgroundColor=f3e8ff,fce7f3,ede9fe`

  function handleToggleLike(e) {
    e.stopPropagation()
    if (!isLiked) {
      setBurstId((n) => n + 1)
      if (navigator.vibrate) navigator.vibrate(12)
    }
    wasLikedRef.current = isLiked
    onToggleLike?.()
  }

  async function handleShare(e) {
    e.stopPropagation()
    const url = `${window.location.origin}/feed/${post.id}`
    if (canShare) {
      try {
        await navigator.share({ text: post.text || 'Un post BomaVibes à découvrir', url })
      } catch {
        // User cancelled the native share sheet — nothing to show.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Lien copié dans le presse-papiers.', 'success')
    } catch {
      showToast('Impossible de partager ce post.', 'error')
    }
  }

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      className="min-w-0 max-w-full cursor-pointer rounded-2xl border border-ink/8 bg-white p-4 shadow-sm transition hover:border-violet-400/30 dark:bg-surface-tint"
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAuthorClick?.()
          }}
          className="flex shrink-0 items-center gap-2.5"
        >
          <img
            src={avatarUrl}
            onError={fullPhoto ? fallbackToFullPhoto(fullPhoto) : undefined}
            alt={author?.firstName || ''}
            className="h-10 w-10 rounded-full object-cover"
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAuthorClick?.()
            }}
            className="truncate text-left text-sm font-semibold text-ink hover:underline"
          >
            {author?.firstName || 'Quelqu’un'}
          </button>
          <p className="truncate text-xs text-ink-soft/50">
            {formatRelativeTime(post.createdAt)}
            {post.editedAt && ' · modifié'}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu((v) => !v)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/5"
            aria-label="Plus d'options"
          >
            <MoreVertical size={16} strokeWidth={2.25} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false) }} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-surface-tint"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onShare?.()
                    }}
                    className="flex w-full items-center gap-2 border-b border-ink/6 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                  >
                    <Send size={14} strokeWidth={2.25} />
                    Envoyer en message
                  </button>
                  {isOwn ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMenu(false)
                          onEdit?.()
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                      >
                        <Pencil size={14} strokeWidth={2.25} />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMenu(false)
                          onDelete?.()
                        }}
                        className="flex w-full items-center gap-2 border-t border-ink/6 px-3.5 py-2.5 text-left text-sm font-medium text-coral-500 hover:bg-coral-500/5"
                      >
                        <Trash2 size={14} strokeWidth={2.25} />
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        onReport?.()
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                    >
                      <Flag size={14} strokeWidth={2.25} />
                      Signaler
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {post.type === 'question' && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          <Sparkles size={12} strokeWidth={2.25} />
          Question du jour
        </p>
      )}

      {post.text && (
        <p className={`min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere] ${post.type === 'question' ? 'mt-1.5 font-medium' : 'mt-3'}`}>
          {post.text}
        </p>
      )}

      {post.photoUrl && (
        <div className="mt-3 max-h-96 w-full overflow-hidden rounded-xl bg-ink/5">
          <img
            src={post.photoThumbUrl || post.photoUrl}
            onError={post.photoThumbUrl ? fallbackToFullPhoto(post.photoUrl) : undefined}
            alt=""
            loading="lazy"
            className="max-h-96 w-full object-cover"
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        <motion.button
          type="button"
          onClick={handleToggleLike}
          whileTap={{ scale: 0.85 }}
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            isLiked ? 'bg-coral-500/10 text-coral-500' : 'text-ink-soft/60 hover:bg-coral-500/5 hover:text-coral-500'
          }`}
        >
          <LikeBurst burstId={burstId} />
          <motion.span
            key={isLiked ? 'liked' : 'unliked'}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
            className="inline-flex"
          >
            <Heart size={17} strokeWidth={2.25} fill={isLiked ? 'currentColor' : 'none'} />
          </motion.span>
          {post.likeCount || 0}
        </motion.button>

        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen?.()
          }}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft/60 transition hover:bg-violet-500/10 hover:text-violet-600"
        >
          <MessageCircle size={17} strokeWidth={2.25} />
          {post.commentCount || 0}
        </motion.button>

        <motion.button
          type="button"
          onClick={handleShare}
          whileTap={{ scale: 0.8, rotate: -15 }}
          whileHover={{ scale: 1.05 }}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft/60 transition hover:bg-violet-500/10 hover:text-violet-600"
          aria-label="Partager"
        >
          <Send size={16} strokeWidth={2.25} />
        </motion.button>
      </div>
    </div>
  )
}

export default PostCard
