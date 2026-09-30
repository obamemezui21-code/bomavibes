import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import AnnouncementCard from '../AnnouncementCard.jsx'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Flag, Heart, MessageCircle, MoreVertical, Pencil, Send, Sparkles, Trash2 } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'
import { useToast } from '../../context/ToastContext.jsx'
import PostText from './PostText.jsx'

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
              className="absolute text-heart-500"
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

// Posts published by the official account for an announcement (see
// backend systemFeedPostService.js) carry { announcement: { title, message,
// ctaLabel, ctaLink } }. Older ones only have the generated image: their
// text is looked up on the announcement that links to them (feedPostId).
const OFFICIAL_UID = 'bomavibes-official'

function useOfficialAnnouncement(post) {
  const isOfficial = post.authorId === OFFICIAL_UID
  const needsLookup = isOfficial && !post.announcement && post.type === 'photo'
  const [found, setFound] = useState(null)

  useEffect(() => {
    if (!needsLookup) return undefined
    let cancelled = false
    getDocs(query(collection(db, 'announcements'), where('feedPostId', '==', post.id), limit(1)))
      .then((snap) => {
        if (cancelled || snap.empty) return
        const a = snap.docs[0].data()
        setFound({ title: a.title, message: a.description, ctaLabel: a.ctaLabel, ctaLink: a.ctaLink })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [needsLookup, post.id])

  if (!isOfficial) return null
  return post.announcement || found
}

function PostCard({ post, author, isLiked, onToggleLike, onAuthorClick, onOpen, currentUserId, onDelete, onEdit, onReport, onShare }) {
  const [showMenu, setShowMenu] = useState(false)
  const [burstId, setBurstId] = useState(0)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const announcement = useOfficialAnnouncement(post)
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

  // ⋮ menu, shared by both layouts; `onPhoto` switches the trigger to a
  // translucent white button that reads on top of an image.
  function renderMenu(onPhoto) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu((v) => !v)
          }}
          className={
            onPhoto
              ? 'flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-black/45'
              : 'flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/5'
          }
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
                className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-surface-tint"
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
    )
  }

  // ❤ 💬 ↗ row, shared by the text card and the announcement card.
  function renderActions() {
    return (
      <div className="mt-1.5 -mb-1 flex items-center gap-1">
        <motion.button
          type="button"
          onClick={handleToggleLike}
          whileTap={{ scale: 0.85 }}
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            isLiked ? 'bg-heart-500/10 text-heart-500' : 'text-ink-soft/60 hover:bg-heart-500/5 hover:text-heart-500'
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
    )
  }

  const authorName = author?.firstName || 'Quelqu’un'

  // Official announcement: centred card over the logo, actions below.
  if (announcement) {
    return (
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
        className="min-w-0 max-w-full cursor-pointer"
      >
        <AnnouncementCard
          announcement={{
            title: announcement.title,
            description: announcement.message,
            ctaLabel: announcement.ctaLabel,
            ctaLink: announcement.ctaLink,
          }}
          onOpen={() => navigate('/annonces')}
        />
        <div className="px-1 pt-1">{renderActions()}</div>
      </div>
    )
  }

  // Photo posts: Friendzy-style full-bleed image card with the text, author
  // chip and actions laid over it.
  if (post.photoUrl) {
    const glassButton =
      'relative flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/25'
    return (
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
        className="relative aspect-[4/3] min-w-0 max-w-full cursor-pointer overflow-hidden rounded-[28px] bg-ink/10 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]"
      >
        <img
          src={post.photoThumbUrl || post.photoUrl}
          onError={post.photoThumbUrl ? fallbackToFullPhoto(post.photoUrl) : undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex max-w-[70%] items-center gap-1 truncate rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            {post.type === 'question' && <Sparkles size={11} strokeWidth={2.5} />}
            {post.type === 'question' ? 'Question du jour' : formatRelativeTime(post.createdAt)}
            {post.editedAt && ' · modifié'}
          </span>
          {renderMenu(true)}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          {post.text && (
            <p className="line-clamp-3 min-w-0 whitespace-pre-wrap font-display text-base font-semibold leading-snug text-white [overflow-wrap:anywhere] [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]">
              {post.text}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAuthorClick?.()
              }}
              className="flex min-w-0 items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 backdrop-blur-md transition hover:bg-white/25"
            >
              <img
                src={avatarUrl}
                onError={fullPhoto ? fallbackToFullPhoto(fullPhoto) : undefined}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
              <span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-white">
                {authorName}
                {author?.isOfficial && <BadgeCheck size={13} strokeWidth={2.5} className="shrink-0 text-violet-300" />}
              </span>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <motion.button
                type="button"
                onClick={handleToggleLike}
                whileTap={{ scale: 0.85 }}
                className={`${glassButton} ${isLiked ? 'text-heart-300' : ''}`}
              >
                <LikeBurst burstId={burstId} />
                <motion.span
                  key={isLiked ? 'liked' : 'unliked'}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                  className="inline-flex"
                >
                  <Heart size={16} strokeWidth={2.25} fill={isLiked ? 'currentColor' : 'none'} />
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
                className={glassButton}
              >
                <MessageCircle size={16} strokeWidth={2.25} />
                {post.commentCount || 0}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleShare}
                whileTap={{ scale: 0.8, rotate: -15 }}
                className={glassButton}
                aria-label="Partager"
              >
                <Send size={15} strokeWidth={2.25} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      className="min-w-0 max-w-full cursor-pointer rounded-[22px] border border-ink/8 bg-white px-3.5 py-3 shadow-sm transition hover:border-violet-400/30 dark:bg-surface-tint"
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
            className="h-9 w-9 rounded-full object-cover"
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAuthorClick?.()
            }}
            className="flex items-center gap-1 truncate text-left text-sm font-semibold text-ink hover:underline"
          >
            {authorName}
            {author?.isOfficial && <BadgeCheck size={14} strokeWidth={2.5} className="shrink-0 text-violet-500" />}
          </button>
          <p className="truncate text-xs text-ink-soft/50">
            {formatRelativeTime(post.createdAt)}
            {post.editedAt && ' · modifié'}
          </p>
        </div>
        {renderMenu(false)}
      </div>

      {post.type === 'question' && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          <Sparkles size={12} strokeWidth={2.25} />
          Question du jour
        </p>
      )}

      {post.text &&
        (post.type === 'question' ? (
          <p className="mt-1 min-w-0 whitespace-pre-wrap text-sm font-medium leading-relaxed text-ink [overflow-wrap:anywhere]">
            {post.text}
          </p>
        ) : (
          <PostText text={post.text} background={post.background} font={post.font} clamp className="mt-2" />
        ))}

      {renderActions()}
    </div>
  )
}

export default PostCard
