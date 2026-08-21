import { useMemo, useState } from 'react'
import { Briefcase, Heart, MapPin, Music2, Search, Ticket } from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'

const CATEGORY_CARDS = [
  { icon: Heart, title: 'Salon des amoureux', subtitle: 'Couples & amour', tint: 'bg-pink-500/15 text-pink-600' },
  { icon: Briefcase, title: 'Salon de métier', subtitle: 'Emploi & services', tint: 'bg-amber-500/15 text-amber-600' },
  { icon: Music2, title: "Stories d'artistes", subtitle: 'Talents à suivre', tint: 'bg-violet-500/15 text-violet-600' },
]

const FILTERS = ['Tout', 'Soirée', 'Concert', 'Conférence', 'Sport', 'Culture', 'Networking']

const CATEGORY_STYLES = {
  Soirée: 'bg-pink-500 text-white',
  Concert: 'bg-violet-500 text-white',
  Conférence: 'bg-sky-500 text-white',
  Sport: 'bg-mint-500 text-white',
  Culture: 'bg-amber-500 text-white',
  Networking: 'bg-teal-500 text-white',
}

// Exemples pour visualiser la mise en page — à remplacer par de vrais
// événements avant mise en production. Il n'existe aucun système
// d'événements/billetterie côté backend pour l'instant.
const SAMPLE_EVENTS = [
  {
    id: '1',
    title: 'Conférence Tech Gabon 2026',
    org: 'Tech Gabon',
    category: 'Conférence',
    day: '20',
    month: 'SEPT.',
    location: 'Paradox Hotel · Libreville',
    price: '10 000 FCFA',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=60',
  },
  {
    id: '2',
    title: 'Festival Culturel Punu',
    org: 'Ministère de la Culture',
    category: 'Culture',
    day: '12',
    month: 'SEPT.',
    location: "Place de l'Indépendance · Libreville",
    price: null,
    image: null,
  },
  {
    id: '3',
    title: 'Networking Business Boma',
    org: 'Boma Business',
    category: 'Networking',
    day: '8',
    month: 'SEPT.',
    location: 'Radisson Blu · Libreville',
    price: '7 500 FCFA',
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=60',
  },
]

function EventsHub() {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Tout')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return SAMPLE_EVENTS.filter((ev) => {
      if (activeFilter !== 'Tout' && ev.category !== activeFilter) return false
      if (query && !ev.title.toLowerCase().includes(query)) return false
      return true
    })
  }, [search, activeFilter])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Événements</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">Soirées, concerts &amp; événements du Gabon 🇬🇦</p>
        </div>
        <button
          type="button"
          onClick={() => showToast('Billetterie bientôt disponible.')}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-pink-600 transition hover:bg-pink-500/10"
        >
          <Ticket size={15} strokeWidth={2.25} />
          Mes billets
        </button>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-ink">Salons &amp; Communauté</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {CATEGORY_CARDS.map((c) => (
          <div key={c.title} className={`w-36 shrink-0 rounded-2xl p-4 ${c.tint}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60">
              <c.icon size={17} strokeWidth={2.25} />
            </span>
            <p className="mt-3 text-sm font-semibold leading-tight">{c.title}</p>
            <p className="mt-0.5 text-xs opacity-80">{c.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-5">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un événement..."
          className="w-full rounded-full border border-ink/12 bg-ink/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15 dark:focus:bg-ink/[0.06]"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              activeFilter === f
                ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-md shadow-violet-500/25'
                : 'border border-ink/12 text-ink-soft/70 hover:bg-ink/5'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
          <Ticket size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm font-medium text-ink-soft/60">Aucun événement pour le moment.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {filtered.map((ev) => (
            <div
              key={ev.id}
              className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm dark:bg-surface-tint"
            >
              <div className="relative h-36 w-full bg-ink/10">
                {ev.image && <img src={ev.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-center leading-none shadow-sm">
                  <p className="text-sm font-bold text-[#2B1D14]">{ev.day}</p>
                  <p className="text-[9px] font-semibold uppercase text-[#6b5d4f]">{ev.month}</p>
                </div>
                <span
                  className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    CATEGORY_STYLES[ev.category] || 'bg-ink/60 text-white'
                  }`}
                >
                  {ev.category}
                </span>
              </div>
              <div className="min-w-0 p-3.5">
                <p className="truncate text-sm font-semibold text-ink">{ev.title}</p>
                <p className="truncate text-xs text-ink-soft/60">par {ev.org}</p>
                <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2 border-t border-ink/6 pt-2.5">
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-soft/60">
                    <MapPin size={12} strokeWidth={2.25} />
                    {ev.location}
                  </p>
                  {ev.price ? (
                    <p className="shrink-0 text-sm font-bold text-ink">{ev.price}</p>
                  ) : (
                    <p className="shrink-0 text-sm font-bold text-mint-600">Gratuit</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EventsHub
