import { ExternalLink, Globe2, Landmark, Music2, Newspaper } from 'lucide-react'
import FlagIcon from '../FlagIcon.jsx'

function formatDate(ts) {
  const date = ts?.toDate?.() || (ts ? new Date(ts) : null)
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
}

// A news article imported from a news site (backend newsService.js):
// its photo, source and date, headline, opening lines, and a link to read the
// whole article on the source site. `compact` clamps the text (Feed).
function NewsCard({ news, photoUrl, compact = true, children }) {
  const date = formatDate(news.publishedAt)
  // "Actu Gabon", "Musique Gabon" or "Afrique" (the first imports had none).
  const category = news.category || 'Actu Gabon'
  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-[28px] bg-white text-ink shadow-[0_18px_40px_-20px_rgba(0,0,0,0.35)] ring-1 ring-ink/6 dark:bg-surface-tint">
      {photoUrl && (
        <div className="relative aspect-[16/9] bg-ink/10">
          <img src={photoUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            {category === 'Afrique' ? (
              <Globe2 size={12} strokeWidth={2.5} />
            ) : (
              <FlagIcon code="GA" className="!h-3 !w-4 rounded-[2px]" />
            )}
            {category === 'Musique Gabon' && <Music2 size={12} strokeWidth={2.5} />}
            {category}
          </span>
        </div>
      )}
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
          {news.sourceSite === 'interieur.gouv.ga' ? (
            <Landmark size={13} strokeWidth={2.25} className="shrink-0" />
          ) : (
            <Newspaper size={13} strokeWidth={2.25} className="shrink-0" />
          )}
          <span className="truncate">
            {news.source}
            {date && <span className="font-medium text-ink-soft/60"> · {date}</span>}
          </span>
        </p>
        <h3 className={`mt-1.5 font-display text-[15px] font-bold leading-snug ${compact ? 'line-clamp-3' : ''}`}>
          {news.title}
        </h3>
        {news.summary && (
          <p className={`mt-1.5 text-sm leading-relaxed text-ink-soft/80 ${compact ? 'line-clamp-3' : ''}`}>
            {news.summary}
          </p>
        )}
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-300"
        >
          Lire l’article sur {news.sourceSite}
          <ExternalLink size={14} strokeWidth={2.25} />
        </a>
        {children}
      </div>
    </article>
  )
}

export default NewsCard
