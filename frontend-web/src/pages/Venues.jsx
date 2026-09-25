import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, LayoutGrid, MapPin as MapPinIcon, MapIcon, Phone, Send } from 'lucide-react'
import { fetchPublishedVenues } from '../firebase/venues.js'
import { fetchPublishedEvents } from '../firebase/events.js'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import SendToModal from '../components/shared/SendToModal.jsx'
import LeafletMap from '../components/map/LeafletMap.jsx'

const FILTERS = ['Tout', 'Restaurant', 'Bar', 'Lounge']

const CATEGORY_STYLES = {
  Restaurant: 'bg-pink-500 text-white',
  Bar: 'bg-violet-500 text-white',
  Lounge: 'bg-gold text-white',
}

function Venues() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sendVenueInviteMessage } = useConversations()
  const { showToast } = useToast()

  const [viewMode, setViewMode] = useState('list')
  const [activeFilter, setActiveFilter] = useState('Tout')
  const [venues, setVenues] = useState([])
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [inviteTarget, setInviteTarget] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    Promise.all([fetchPublishedVenues(), fetchPublishedEvents()])
      .then(([publishedVenues, publishedEvents]) => {
        setVenues(publishedVenues)
        setEvents(publishedEvents)
      })
      .catch(() => showToast('Impossible de charger les Coins Chics.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const venueParam = searchParams.get('venue')
    if (venueParam) {
      setSelectedId(venueParam)
      setViewMode('map')
    }
  }, [searchParams])

  const filtered = useMemo(
    () => (activeFilter === 'Tout' ? venues : venues.filter((v) => v.category === activeFilter)),
    [venues, activeFilter],
  )

  const eventsWithPin = useMemo(() => events.filter((ev) => ev.lat != null && ev.lng != null), [events])

  const markers = useMemo(
    () => [
      ...filtered.filter((v) => v.lat != null).map((v) => ({ id: `venue-${v.id}`, lat: v.lat, lng: v.lng, variant: 'venue' })),
      ...eventsWithPin.map((ev) => ({ id: `event-${ev.id}`, lat: ev.lat, lng: ev.lng, variant: 'event' })),
    ],
    [filtered, eventsWithPin],
  )

  const selectedVenue = venues.find((v) => v.id === selectedId)
  const selectedEvent = events.find((ev) => ev.id === selectedId)

  function handleMarkerClick(markerId) {
    const [kind, id] = markerId.split('-')
    setSelectedId(id)
    if (kind === 'event') navigate('/events')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-ink">Coins Chics</h1>
          <p className="text-xs text-ink-soft/60">Les meilleurs spots pour un premier rendez-vous</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 rounded-full bg-ink/6 p-1">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition ${
            viewMode === 'list' ? 'bg-white text-ink shadow-sm dark:bg-surface-tint' : 'text-ink-soft/60'
          }`}
        >
          <LayoutGrid size={13} strokeWidth={2.25} />
          Liste
        </button>
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition ${
            viewMode === 'map' ? 'bg-white text-ink shadow-sm dark:bg-surface-tint' : 'text-ink-soft/60'
          }`}
        >
          <MapIcon size={13} strokeWidth={2.25} />
          Carte
        </button>
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

      {!isLoading && viewMode === 'list' && filtered.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
          <MapPinIcon size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm font-medium text-ink-soft/60">Aucun lieu pour le moment.</p>
        </div>
      )}

      {!isLoading && viewMode === 'list' && filtered.length > 0 && (
        <div className="mt-4 space-y-4">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm dark:bg-surface-tint"
            >
              <div className="relative h-36 w-full bg-ink/10">
                {v.image && <img src={v.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <span
                  className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    CATEGORY_STYLES[v.category] || 'bg-ink/60 text-white'
                  }`}
                >
                  {v.category}
                </span>
              </div>
              <div className="min-w-0 p-3.5">
                <p className="truncate text-sm font-semibold text-ink">{v.name}</p>
                {(v.address || v.city) && (
                  <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs text-ink-soft/60">
                    <MapPinIcon size={12} strokeWidth={2.25} />
                    {[v.address, v.city].filter(Boolean).join(', ')}
                  </p>
                )}
                {v.phone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft/60">
                    <Phone size={12} strokeWidth={2.25} />
                    {v.phone}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setInviteTarget(v)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition"
                >
                  <Send size={14} strokeWidth={2.25} />
                  Inviter dans ce lieu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && viewMode === 'map' && (
        <div className="mt-4">
          <LeafletMap markers={markers} onMarkerClick={handleMarkerClick} height="360px" />

          {selectedVenue && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-ink/8 bg-white p-3.5 shadow-sm dark:bg-surface-tint">
              {selectedVenue.image && (
                <img src={selectedVenue.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{selectedVenue.name}</p>
                {(selectedVenue.address || selectedVenue.city) && (
                  <p className="truncate text-xs text-ink-soft/60">
                    {[selectedVenue.address, selectedVenue.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setInviteTarget(selectedVenue)}
                  className="mt-2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/25"
                >
                  <Send size={12} strokeWidth={2.25} />
                  Inviter dans ce lieu
                </button>
              </div>
            </div>
          )}

          {selectedEvent && !selectedVenue && (
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="mt-3 flex w-full items-start gap-3 rounded-2xl border border-ink/8 bg-white p-3.5 text-left shadow-sm dark:bg-surface-tint"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{selectedEvent.title}</p>
                <p className="truncate text-xs text-ink-soft/60">{selectedEvent.location}</p>
              </div>
            </button>
          )}
        </div>
      )}

      {inviteTarget && (
        <SendToModal
          title="Inviter dans ce lieu"
          sendLabel="Inviter"
          emptyText="Faites un match pour pouvoir inviter quelqu'un ici."
          onSend={(matchId) => sendVenueInviteMessage(matchId, inviteTarget)}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  )
}

export default Venues
