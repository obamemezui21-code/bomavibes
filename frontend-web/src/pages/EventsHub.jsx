import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Heart, MapPin, Music2, Search, Ticket } from 'lucide-react'
import { cancelEventTicket, fetchMyTickets, fetchPublishedEvents, reserveEventTicket } from '../firebase/events.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import Modal from '../components/ui/Modal.jsx'
import Button from '../components/ui/Button.jsx'

const CATEGORY_CARDS = [
  { icon: Heart, title: 'Salon des amoureux', subtitle: 'Couples & amour', tint: 'bg-pink-500/15 text-pink-600' },
  { icon: Briefcase, title: 'Salon de métier', subtitle: 'Emploi & services', tint: 'bg-gold/15 text-gold' },
  { icon: Music2, title: "Stories d'artistes", subtitle: 'Talents à suivre', tint: 'bg-violet-500/15 text-violet-600' },
]

const FILTERS = ['Tout', 'Soirée', 'Concert', 'Conférence', 'Sport', 'Culture', 'Networking']

const CATEGORY_STYLES = {
  Soirée: 'bg-pink-500 text-white',
  Concert: 'bg-violet-500 text-white',
  Conférence: 'bg-sky-500 text-white',
  Sport: 'bg-mint-500 text-white',
  Culture: 'bg-gold text-white',
  Networking: 'bg-forest text-white',
}

function formatEventDayMonth(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { day: '?', month: '' }
  return {
    day: d.toLocaleDateString('fr-FR', { day: 'numeric' }),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase(),
  }
}

function EventsHub() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Tout')
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [myEventIds, setMyEventIds] = useState(new Set())
  const [pendingId, setPendingId] = useState(null)
  const [reservingEvent, setReservingEvent] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    Promise.all([fetchPublishedEvents(), fetchMyTickets().catch(() => ({ tickets: [] }))])
      .then(([publishedEvents, myTickets]) => {
        setEvents(publishedEvents)
        setMyEventIds(new Set(myTickets.tickets.map((t) => t.eventId)))
      })
      .catch(() => showToast('Impossible de charger les événements.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((ev) => {
      if (activeFilter !== 'Tout' && ev.category !== activeFilter) return false
      if (q && !ev.title?.toLowerCase().includes(q)) return false
      return true
    })
  }, [events, search, activeFilter])

  function openReservationForm(ev) {
    setForm({ name: profile?.firstName || user?.firstName || '', email: user?.email || '', phone: '' })
    setReservingEvent(ev)
  }

  async function handleCancel(ev) {
    setPendingId(ev.id)
    try {
      await cancelEventTicket(ev.id)
      setMyEventIds((prev) => {
        const next = new Set(prev)
        next.delete(ev.id)
        return next
      })
      showToast('Réservation annulée.', 'success')
    } catch (err) {
      showToast(err.message || 'Impossible d’annuler ta réservation.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  async function handleSubmitReservation(e) {
    e.preventDefault()
    if (!reservingEvent || !form.name.trim()) return
    setIsSubmitting(true)
    try {
      await reserveEventTicket(reservingEvent.id, {
        attendeeName: form.name.trim(),
        attendeeEmail: form.email.trim(),
        attendeePhone: form.phone.trim(),
      })
      setMyEventIds((prev) => new Set(prev).add(reservingEvent.id))
      showToast('Place réservée — retrouve ton billet dans "Mes billets".', 'success')
      setReservingEvent(null)
    } catch (err) {
      showToast(err.message || 'Impossible de réserver cette place.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Événements</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">Soirées, concerts &amp; événements du Gabon 🇬🇦</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/events/mine')}
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

      {isLoading && <p className="mt-10 py-10 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
          <Ticket size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm font-medium text-ink-soft/60">Aucun événement pour le moment.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {filtered.map((ev) => {
            const { day, month } = formatEventDayMonth(ev.date)
            const isReserved = myEventIds.has(ev.id)
            const isFull = ev.capacity > 0 && (ev.ticketsReserved || 0) >= ev.capacity && !isReserved
            return (
              <div
                key={ev.id}
                className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm dark:bg-surface-tint"
              >
                <div className="relative h-36 w-full bg-ink/10">
                  {ev.image && <img src={ev.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-center leading-none shadow-sm">
                    <p className="text-sm font-bold text-ink-on-brand">{day}</p>
                    <p className="text-[9px] font-semibold uppercase text-ink-on-brand/70">{month}</p>
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
                  {ev.organizer && <p className="truncate text-xs text-ink-soft/60">par {ev.organizer}</p>}
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
                  <button
                    type="button"
                    onClick={() => (isReserved ? handleCancel(ev) : openReservationForm(ev))}
                    disabled={pendingId === ev.id || isFull}
                    className={`mt-3 w-full rounded-full py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isReserved
                        ? 'bg-ink/6 text-ink-soft/70 hover:bg-coral-500/10 hover:text-coral-600'
                        : 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25'
                    }`}
                  >
                    {pendingId === ev.id
                      ? 'Un instant…'
                      : isReserved
                        ? 'Réservé ✓ — Annuler'
                        : isFull
                          ? 'Complet'
                          : 'Réserver ma place'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reservingEvent && (
        <Modal onClose={() => setReservingEvent(null)} className="max-w-sm text-left">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">Réserver ma place</h2>
          <p className="mb-4 text-sm text-ink-soft/60">{reservingEvent.title}</p>
          <form onSubmit={handleSubmitReservation} className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="attendeeName">
                Nom complet *
              </label>
              <input
                id="attendeeName"
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="attendeeEmail">
                Email
              </label>
              <input
                id="attendeeEmail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="attendeePhone">
                Téléphone
              </label>
              <input
                id="attendeePhone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setReservingEvent(null)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting || !form.name.trim()}>
                {isSubmitting ? 'Réservation…' : 'Confirmer'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default EventsHub
