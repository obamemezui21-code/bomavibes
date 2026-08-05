import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Leaf } from 'lucide-react'

function formatPublishedAt(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function NewsCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-3xl border border-[#1F3D2B]/8 bg-white">
      <div className="h-44 bg-[#1F3D2B]/8" />
      <div className="space-y-3 p-6">
        <div className="h-4 w-3/4 rounded bg-[#1F3D2B]/10" />
        <div className="h-3 w-full rounded bg-[#1F3D2B]/8" />
        <div className="h-3 w-2/3 rounded bg-[#1F3D2B]/8" />
      </div>
    </div>
  )
}

function WwfNewsSection() {
  const [state, setState] = useState({ loading: true, articles: [], error: null })

  useEffect(() => {
    let cancelled = false
    fetch('/api/news/wwf-gabon')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, articles: data.articles || [], error: data.error })
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, articles: [], error: 'Impossible de charger les actualités pour le moment.' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!state.loading && state.articles.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-10">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9c7220]">
          <Leaf size={14} strokeWidth={2.5} />
          En partenariat avec WWF Gabon
        </p>
        <h2 className="mt-2 font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Notre engagement</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#6b5d4f]">
          Les dernières nouvelles de WWF Gabon, pour une communauté qui célèbre aussi ses racines.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {state.loading
          ? Array.from({ length: 3 }).map((_, i) => <NewsCardSkeleton key={i} />)
          : state.articles.map((article, i) => {
              const publishedLabel = formatPublishedAt(article.publishedAt)
              return (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}
                  className="flex flex-col overflow-hidden rounded-3xl border border-[#1F3D2B]/8 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {article.image && (
                    <div className="h-44 overflow-hidden bg-[#1F3D2B]/5">
                      <img
                        src={article.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    {publishedLabel && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">{publishedLabel}</p>
                    )}
                    <h3 className="mt-2 font-display text-lg font-bold leading-snug text-[#2B1D14]">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-[#6b5d4f]">{article.excerpt}</p>
                    )}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F3D2B] underline-offset-4 hover:underline"
                    >
                      Lire l'article
                      <ArrowUpRight size={15} strokeWidth={2.5} />
                    </a>
                  </div>
                </motion.div>
              )
            })}
      </div>
    </section>
  )
}

export default WwfNewsSection
