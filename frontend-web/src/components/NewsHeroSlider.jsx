import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Newspaper } from 'lucide-react'
import { fetchHeadlines } from '../lib/headlines.js'

const AUTOPLAY_MS = 6000

function formatDate(iso) {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null
}

// "À la une" at the top of Découvrir: the latest articles of gouvernement.ga
// (backend headlinesService.js), each opening on that site. Slides are a
// native snap scroller, so a finger swipes them at once; it moves on by itself
// except while it's being touched, hovered or focused, or for members who ask
// for less motion. No articles: nothing is shown, and Découvrir is unchanged.
function NewsHeroSlider() {
  const [slides, setSlides] = useState([])
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const scroller = useRef(null)
  const reducedMotion = useReducedMotion()
  const count = slides.length

  useEffect(() => {
    let live = true
    fetchHeadlines().then((list) => live && setSlides(list))
    return () => {
      live = false
    }
  }, [])

  const goTo = useCallback(
    (target) => {
      const el = scroller.current
      if (!el || !count) return
      const next = (target + count) % count
      el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [count, reducedMotion],
  )

  useEffect(() => {
    if (count < 2 || held || reducedMotion) return undefined
    const timer = setInterval(() => {
      if (!document.hidden) goTo(index + 1)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [count, held, reducedMotion, index, goTo])

  function handleScroll() {
    const el = scroller.current
    if (!el?.clientWidth) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (!count) return null

  return (
    <section
      aria-label="À la une"
      className="relative mb-4 overflow-hidden rounded-[24px] bg-ink/10 shadow-lg shadow-black/15"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div ref={scroller} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, i) => (
          <a
            key={slide.id}
            href={slide.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${slide.title}, sur ${slide.source}`}
            tabIndex={i === index ? 0 : -1}
            className="relative block aspect-[16/10] w-full shrink-0 snap-center snap-always bg-gradient-to-br from-violet-900 to-ink sm:aspect-[16/9]"
          >
            <img
              src={slide.image}
              alt=""
              loading={i < 2 ? 'eager' : 'lazy'}
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />
            <span className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              À la une
            </span>
            <span className="absolute inset-x-0 bottom-0 block px-4 pb-7 sm:pb-8">
              <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-amber-300">{slide.category}</span>
              <span className="mt-0.5 line-clamp-3 font-display text-[15px] font-bold leading-snug text-white sm:text-lg">{slide.title}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-white/75">
                <Newspaper size={11} strokeWidth={2.25} className="shrink-0" />
                {slide.source}
                {formatDate(slide.publishedAt) && ` · ${formatDate(slide.publishedAt)}`}
              </span>
            </span>
          </a>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Article précédent"
            className="absolute left-2 top-[30%] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 sm:flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Article suivant"
            className="absolute right-2 top-[30%] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 sm:flex"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-0.5">
            {slides.map((slide, i) => (
              <button key={slide.id} type="button" onClick={() => goTo(i)} aria-label={`Article ${i + 1} sur ${count}`} aria-current={i === index} className="flex h-5 w-5 items-center justify-center">
                <span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default NewsHeroSlider
