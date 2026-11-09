import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin } from 'lucide-react'
import { fetchPublishedEvents } from '../firebase/events.js'

const SHOWN = 4

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayMonth(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return {
    day: d.toLocaleDateString('fr-FR', { day: 'numeric' }),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  }
}

// The cards alone, so they can be shown with any list of events.
export function UpcomingEventsRow({ events, onOpen }) {
  return (
    <section aria-labelledby="discover-events-title" className="w-full">
      <div className="flex items-center justify-between px-1 desktop:flex-col desktop:justify-start desktop:gap-0.5 desktop:text-center">
        <div>
          <h2 id="discover-events-title" className="font-display text-base font-semibold text-ink">
            📅 Sorties à venir
          </h2>
          <p className="text-xs text-ink-soft/60">Concerts, soirées et rencontres près de toi</p>
        </div>
        <button type="button" onClick={() => onOpen()} className="shrink-0 text-xs font-semibold text-violet-600 hover:underline">
          Tout voir →
        </button>
      </div>

      <div className="mt-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 desktop:mx-auto desktop:w-max">
          {events.map((ev) => {
            const date = dayMonth(ev.date)
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onOpen(ev)}
                className="w-64 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-surface-tint"
              >
                <div className="relative aspect-[16/9] bg-gradient-to-br from-violet-800 to-coral-600">
                  {ev.image ? (
                    <img src={ev.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <CalendarDays size={36} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60" />
                  )}
                  {date && (
                    <span className="absolute left-2 top-2 flex flex-col items-center rounded-xl bg-white px-2 py-1 leading-none text-ink shadow">
                      <span className="font-display text-base font-black">{date.day}</span>
                      <span className="text-[9px] font-bold text-coral-600">{date.month}</span>
                    </span>
                  )}
                  {ev.category && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {ev.category}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink">{ev.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {ev.location ? (
                      <p className="flex min-w-0 items-center gap-1 text-xs text-ink-soft/60">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    ) : (
                      <span />
                    )}
                    <p className="shrink-0 text-xs font-bold text-ink">{ev.price || 'Gratuit'}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Découvrir, under the games: the next published events, soonest first.
// None coming (or the list can't be read): the section isn't shown.
function DiscoverEventsRow() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])

  useEffect(() => {
    let live = true
    const today = todayKey()
    fetchPublishedEvents()
      .then((list) => live && setEvents(list.filter((ev) => String(ev.date || '') >= today).slice(0, SHOWN)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  if (!events.length) return null
  return <UpcomingEventsRow events={events} onOpen={() => navigate('/events')} />
}

export default DiscoverEventsRow
