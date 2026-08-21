import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Flag, MoreVertical, Trash2, X } from 'lucide-react'
import { fallbackToFullPhoto } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'

const STORY_DURATION_MS = 5000

// `groups` is an array of { author, stories } — one entry per person with at
// least one active story, in the same order as the story bar's avatar row.
function StoryViewer({ groups, startGroupIndex, currentUserId, onClose, onViewed, onDelete, onReport }) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)
  const startRef = useRef(0)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isOwn = story?.authorId === currentUserId

  function goNext() {
    setShowMenu(false)
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  function goPrev() {
    setShowMenu(false)
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((i) => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  useEffect(() => {
    if (!story) return
    if (!isOwn) onViewed?.(story)
    setProgress(0)
    startRef.current = performance.now()

    function tick(now) {
      const pct = Math.min(1, (now - startRef.current) / STORY_DURATION_MS)
      setProgress(pct)
      if (pct >= 1) {
        goNext()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex, groups])

  if (!group || !story) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-md">
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {group.stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%' }}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-x-3 top-7 z-20 flex items-center gap-2.5">
          <img
            src={group.author?.photos?.[0]}
            onError={fallbackToFullPhoto(group.author?.photos?.[0])}
            alt=""
            className="h-9 w-9 rounded-full border border-white/30 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{group.author?.firstName || 'Quelqu’un'}</p>
            <p className="truncate text-xs text-white/70">{formatRelativeTime(story.createdAt)}</p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((v) => !v)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              aria-label="Options"
            >
              <MoreVertical size={18} strokeWidth={2.25} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-9 w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-surface-tint">
                {isOwn ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete?.(story)
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
                      onReport?.(story)
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/5"
                  >
                    <Flag size={14} strokeWidth={2.25} />
                    Signaler
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            aria-label="Fermer"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <motion.div
          key={story.id}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex h-full w-full items-center justify-center"
          style={{ background: story.type === 'text' ? story.background || 'linear-gradient(135deg,#a855f7,#ec4899)' : '#000' }}
        >
          {story.type === 'photo' ? (
            <img src={story.photoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <p className="max-w-[85%] whitespace-pre-wrap break-words text-center text-2xl font-semibold text-white [overflow-wrap:anywhere]">
              {story.text}
            </p>
          )}
        </motion.div>

        <button type="button" onClick={goPrev} className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label="Story précédente" />
        <button type="button" onClick={goNext} className="absolute inset-y-0 right-0 z-10 w-2/3" aria-label="Story suivante" />
      </div>
    </div>
  )
}

export default StoryViewer
