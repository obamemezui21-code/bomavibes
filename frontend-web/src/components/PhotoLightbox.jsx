import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { nextIndex } from '../lib/slideshow.js'

// How far (px) or how fast (px/s) a swipe must go to change photo.
const SWIPE_OFFSET = 70
const SWIPE_VELOCITY = 400
const HISTORY_KEY = 'bvPhotoLightbox'

const slide = {
  enter: (dir) => ({ x: dir > 0 ? '60%' : dir < 0 ? '-60%' : 0, opacity: 0, scale: dir ? 1 : 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
}

/**
 * A profile's photos full screen, as stored (the full-size upload, the one
 * the profile already shows: no new copy is loaded). Swipe sideways or use
 * the arrows (keys too) to change photo; ✕, Escape or the phone's back
 * button close it.
 *
 * Only the photo shown is drawn; its neighbours are fetched in the
 * background so the next swipe is instant.
 *
 * @param {{ photos: string[], alt: string, index: number,
 *   onIndexChange: (i: number) => void, onClose: () => void }} props
 */
function PhotoLightbox({ photos, alt, index, onIndexChange, onClose }) {
  const count = photos.length
  const multiple = count > 1
  const [direction, setDirection] = useState(0)
  const [loaded, setLoaded] = useState(() => new Set())
  const dialogRef = useRef(null)
  const closingRef = useRef(false)

  const go = (step) => {
    if (!multiple) return
    setDirection(step)
    onIndexChange(nextIndex(index, step, count))
  }

  // The phone's back button closes the gallery, not the page: an extra
  // history entry is added while it's open (once, even under StrictMode).
  useEffect(() => {
    if (!window.history.state?.[HISTORY_KEY]) {
      window.history.pushState({ ...window.history.state, [HISTORY_KEY]: true }, '')
    }
    const onPop = () => {
      closingRef.current = true
      onClose()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  function close() {
    if (closingRef.current) return
    closingRef.current = true
    // Leave the extra entry: the popstate it fires closes the gallery.
    if (window.history.state?.[HISTORY_KEY]) window.history.back()
    else onClose()
  }

  // Nothing behind scrolls while it's open; keys go to the gallery.
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  // Fetch the previous and next photos ahead of the swipe.
  useEffect(() => {
    if (!multiple) return
    for (const step of [1, -1]) {
      const img = new Image()
      img.decoding = 'async'
      img.src = photos[nextIndex(index, step, count)]
    }
  }, [index, multiple, count, photos])

  function onKeyDown(e) {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const src = photos[index]
  const isLoaded = loaded.has(src)

  return createPortal(
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={multiple ? `Photos de ${alt}, ${index + 1} sur ${count}` : `Photo de ${alt}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex select-none flex-col bg-black outline-none"
      style={{ touchAction: 'none' }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        )}
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={src}
            src={src}
            alt={alt}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'spring', stiffness: 360, damping: 36 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
            drag={multiple ? 'x' : false}
            dragSnapToOrigin
            dragElastic={0.6}
            onDragEnd={(_, { offset, velocity }) => {
              if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) go(1)
              else if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) go(-1)
            }}
            onLoad={() => setLoaded((s) => (s.has(src) ? s : new Set(s).add(src)))}
            draggable={false}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-contain ${multiple ? 'cursor-grab active:cursor-grabbing' : ''}`}
          />
        </AnimatePresence>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:flex"
              aria-label="Photo précédente"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:flex"
              aria-label="Photo suivante"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Top bar over the photo: position, and ✕ Fermer. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-sm font-semibold text-white/85" aria-hidden="true">
          {multiple ? `${index + 1} / ${count}` : ''}
        </span>
        <button
          type="button"
          onClick={close}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/15 py-2 pl-3 pr-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/25 active:scale-95"
        >
          <X size={17} strokeWidth={2.5} /> Fermer
        </button>
      </div>

      {multiple && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
          aria-hidden="true"
        >
          {photos.map((p, i) => (
            <span
              key={p}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {multiple ? `Photo ${index + 1} sur ${count}` : ''}
      </p>
    </motion.div>,
    document.body,
  )
}

export default PhotoLightbox
