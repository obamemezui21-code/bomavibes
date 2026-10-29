import { useEffect, useRef, useState } from 'react'
import { nextIndex, gestureFor } from '../lib/slideshow.js'

const HOLD_MS = 280

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/**
 * A profile's photos, changed by hand: tap the left / right half for the
 * previous / next photo, or swipe sideways; arrow keys work too. Bars at the
 * top show which photo is on. One photo: no bars.
 *
 * The main photo comes first (photos[0]). Overlays (gradient, buttons) go in
 * `children`, drawn over the photos.
 */
function PhotoSlideshow({ photos, alt, children }) {
  const [index, setIndex] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const gesture = useRef(null)
  const count = photos.length
  const multiple = count > 1

  // Another profile: start again from its main photo.
  const photosKey = photos.join('|')
  useEffect(() => setIndex(0), [photosKey])

  const go = (step) => setIndex((i) => nextIndex(i, step, count))

  function onPointerDown(e) {
    if (!multiple || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      width: rect.width,
      // A long press only looks: it doesn't change the photo.
      timer: setTimeout(() => {
        if (gesture.current) gesture.current.held = true
      }, HOLD_MS),
    }
  }

  function endGesture(e, cancelled) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    clearTimeout(g.timer)
    gesture.current = null
    if (cancelled) return
    const step = gestureFor({ dx: e.clientX - g.x, dy: e.clientY - g.y, x: e.clientX - g.left, width: g.width, held: !!g.held })
    if (step) go(step)
  }

  function onKeyDown(e) {
    if (!multiple) return
    if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
    else return
    e.preventDefault()
  }

  return (
    <div
      className="absolute inset-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
      style={{ touchAction: 'pan-y' }}
      role="group"
      aria-roledescription="diaporama"
      aria-label={multiple ? `Photos de ${alt} : flèches gauche et droite pour changer` : `Photo de ${alt}`}
      tabIndex={multiple ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerUp={(e) => endGesture(e, false)}
      onPointerCancel={(e) => endGesture(e, true)}
      onKeyDown={onKeyDown}
    >
      {photos.map((src, i) => {
        // The current photo, and the next one loaded in advance.
        const near = i === index || i === nextIndex(index, 1, count)
        return (
          <img
            key={src}
            src={src}
            alt={i === index ? alt : ''}
            aria-hidden={i !== index}
            draggable={false}
            loading={near ? 'eager' : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover ${reducedMotion ? '' : 'transition-opacity duration-300 ease-out'} ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      })}

      {children}

      {multiple && (
        <>
          <div className="pointer-events-none absolute inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[5] flex gap-1.5">
            {photos.map((src, i) => (
              <span key={src} className={`h-1 flex-1 rounded-full ${i === index ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Photo {index + 1} sur {count}
          </p>
        </>
      )}
    </div>
  )
}

export default PhotoSlideshow
