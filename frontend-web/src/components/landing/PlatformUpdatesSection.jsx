import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Newspaper } from 'lucide-react'

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function UpdateCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-[#1F3D2B]/8 bg-white p-6">
      <div className="h-3 w-24 rounded bg-[#1F3D2B]/10" />
      <div className="mt-3 h-4 w-3/4 rounded bg-[#1F3D2B]/10" />
      <div className="mt-3 h-3 w-full rounded bg-[#1F3D2B]/8" />
      <div className="mt-2 h-3 w-2/3 rounded bg-[#1F3D2B]/8" />
    </div>
  )
}

function PlatformUpdatesSection() {
  const [state, setState] = useState({ loading: true, updates: [] })

  useEffect(() => {
    let cancelled = false
    fetch('/api/news/updates')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, updates: data.updates || [] })
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, updates: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!state.loading && state.updates.length === 0) return null

  return (
    <section id="actualites" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9c7220]">
          <Newspaper size={14} strokeWidth={2.5} />
          Nouveautés
        </p>
        <h2 className="mt-2 font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Actualités BomaVibes</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#6b5d4f]">
          Ce qui vient d'arriver sur la plateforme.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {state.loading
          ? Array.from({ length: 4 }).map((_, i) => <UpdateCardSkeleton key={i} />)
          : state.updates.map((u, i) => {
              const dateLabel = formatDate(u.createdAt)
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}
                  className="flex flex-col rounded-3xl border border-[#1F3D2B]/8 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {dateLabel && <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">{dateLabel}</p>}
                  <h3 className="mt-2 font-display text-base font-bold leading-snug text-[#2B1D14]">{u.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#6b5d4f]">{u.description}</p>
                  {u.ctaLink && (
                    <a
                      href={u.ctaLink}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F3D2B] underline-offset-4 hover:underline"
                    >
                      {u.ctaLabel || 'En savoir plus'}
                      <ArrowUpRight size={14} strokeWidth={2.5} />
                    </a>
                  )}
                </motion.div>
              )
            })}
      </div>
    </section>
  )
}

export default PlatformUpdatesSection
