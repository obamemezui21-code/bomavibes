import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Flag, MoreVertical, Trash2, Volume2, VolumeX, X } from 'lucide-react'
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
  const [muted, setMuted] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const videoRef = useRef(null)
  const errorTimerRef = useRef(null)
  // Press-and-hold pauses the story, as on WhatsApp; releasing resumes it
  // without skipping to the next one.
  const pausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const holdRef = useRef({ timer: null, held: false })

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isOwn = story?.authorId === currentUserId
  const isVideo = story?.type === 'video' && !!story.videoUrl

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
    elapsedRef.current = 0
    pausedRef.current = false

    // A video story drives its own progress bar and moves on when it ends.
    if (story.type === 'video' && story.videoUrl) {
      const video = videoRef.current
      // Sound on if the browser allows it, otherwise start muted.
      video?.play().catch(() => {
        setMuted(true)
        video.muted = true
        video.play().catch(() => {})
      })
      return () => clearTimeout(errorTimerRef.current)
    }

    let last = performance.now()
    function tick(now) {
      if (!pausedRef.current) elapsedRef.current += now - last
      last = now
      const pct = Math.min(1, elapsedRef.current / STORY_DURATION_MS)
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

  function holdStart() {
    clearTimeout(holdRef.current.timer)
    holdRef.current.held = false
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.held = true
      pausedRef.current = true
      videoRef.current?.pause()
    }, 220)
  }

  function holdEnd() {
    clearTimeout(holdRef.current.timer)
    if (!pausedRef.current) return
    pausedRef.current = false
    videoRef.current?.play().catch(() => {})
  }

  // A tap navigates; the release of a long press only resumes.
  function tapTo(go) {
    return () => {
      if (holdRef.current.held) {
        holdRef.current.held = false
        return
      }
      go()
    }
  }

  const tapZone = {
    onPointerDown: holdStart,
    onPointerUp: holdEnd,
    onPointerLeave: holdEnd,
    onPointerCancel: holdEnd,
    onContextMenu: (e) => e.preventDefault(),
  }

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
          {isVideo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMuted((m) => !m)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              aria-label={muted ? 'Activer le son' : 'Couper le son'}
            >
              {muted ? <VolumeX size={18} strokeWidth={2.25} /> : <Volume2 size={18} strokeWidth={2.25} />}
            </button>
          )}
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
          style={{ background: story.type === 'text' ? story.background || 'linear-gradient(135deg,#a95dda,#e652a3)' : '#000' }}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={story.videoUrl}
              poster={story.photoThumbUrl || undefined}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration))
              }}
              onEnded={goNext}
              // Unplayable here (codec, network): show the poster briefly, then move on.
              onError={() => {
                errorTimerRef.current = setTimeout(goNext, 2500)
              }}
              className="h-full w-full object-contain"
            />
          ) : story.type === 'photo' ? (
            <img src={story.photoUrl} alt="" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <p className="max-w-[85%] whitespace-pre-wrap break-words text-center text-2xl font-semibold text-white [overflow-wrap:anywhere]">
              {story.text}
            </p>
          )}
        </motion.div>

        {/* Caption of a photo or video story */}
        {story.type !== 'text' && story.text && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
            <p className="whitespace-pre-wrap break-words text-center text-base font-medium text-white [overflow-wrap:anywhere]">
              {story.text}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={tapTo(goPrev)}
          {...tapZone}
          className="absolute inset-y-0 left-0 z-10 w-1/3 select-none"
          aria-label="Story précédente"
        />
        <button
          type="button"
          onClick={tapTo(goNext)}
          {...tapZone}
          className="absolute inset-y-0 right-0 z-10 w-2/3 select-none"
          aria-label="Story suivante"
        />
      </div>
    </div>
  )
}

export default StoryViewer
