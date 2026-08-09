import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Heart, MessageCircle, MoreVertical, Sparkles, Trash2 } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'

function PostCard({ post, author, isLiked, onToggleLike, onAuthorClick, onOpen, currentUserId, onDelete, onReport }) {
  const [showMenu, setShowMenu] = useState(false)
  const isOwn = post.authorId === currentUserId
  const fullPhoto = author?.photos?.[0]
  const avatarUrl = fullPhoto
    ? photoVariant(fullPhoto, 'thumb')
    : `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(author?.firstName || post.authorId)}&backgroundColor=f3e8ff,fce7f3,ede9fe`

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
          <p className="truncate text-xs text-ink-soft/50">{formatRelativeTime(post.createdAt)}</p>
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
                  {isOwn ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        onDelete?.()
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-coral-500 hover:bg-coral-500/5"
                    >
                      <Trash2 size={14} strokeWidth={2.25} />
                      Supprimer
                    </button>
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

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleLike?.()
          }}
          className={`flex items-center gap-1.5 text-sm font-medium transition ${isLiked ? 'text-coral-500' : 'text-ink-soft/60 hover:text-coral-500'}`}
        >
          <Heart size={17} strokeWidth={2.25} fill={isLiked ? 'currentColor' : 'none'} />
          {post.likeCount || 0}
        </button>
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft/60">
          <MessageCircle size={17} strokeWidth={2.25} />
          {post.commentCount || 0}
        </span>
      </div>
    </div>
  )
}

export default PostCard
