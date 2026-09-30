import { Megaphone, X } from 'lucide-react'
import logo from '../assets/bomavibes-logo.webp'

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// An official announcement: the BomaVibes logo fills the card behind a
// see-through black layer, content centred on top in white. Used on the
// Annonces page and (compact, dismissible) at the top of Discover.
function AnnouncementCard({ announcement, compact = false, onOpen, onDismiss }) {
  const { title, description, ctaLabel, ctaLink, date } = announcement

  return (
    <div
      className={`relative isolate overflow-hidden rounded-3xl text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ${
        compact ? 'min-h-[190px]' : 'min-h-[240px]'
      }`}
    >
      <img src={logo} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-black/60" />

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
          aria-label="Fermer l'annonce"
        >
          <X size={15} strokeWidth={2.25} />
        </button>
      )}

      <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? 'min-h-[190px] px-6 py-6' : 'min-h-[240px] px-7 py-8'}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm">
          <Megaphone size={12} strokeWidth={2.5} />
          Annonce BomaVibes
        </span>
        <h3 className={`mt-3 font-display font-bold leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.5)] ${compact ? 'text-lg' : 'text-xl'}`}>
          {title}
        </h3>
        {date && !compact && <p className="mt-1 text-xs text-white/70">{formatDate(date)}</p>}
        {description && (
          <p
            className={`mt-2 max-w-md text-sm leading-relaxed text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] ${
              compact ? 'line-clamp-3' : 'whitespace-pre-line'
            }`}
          >
            {description}
          </p>
        )}

        {compact && onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-violet-950 transition hover:bg-white/90"
          >
            En savoir plus
          </button>
        ) : (
          ctaLink && (
            <a
              href={ctaLink}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-violet-950 transition hover:bg-white/90"
            >
              {ctaLabel || 'Découvrir'}
            </a>
          )
        )}
      </div>
    </div>
  )
}

export default AnnouncementCard
