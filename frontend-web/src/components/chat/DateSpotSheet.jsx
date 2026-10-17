import { useEffect, useMemo, useState } from 'react'
import { MapPin, Sparkles, X } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import { fetchPublishedVenues } from '../../firebase/venues.js'
import { rankDateSpots } from '../../lib/dateSpots.js'

const RECOMMENDED = 3

function Row({ venue, reason, highlight, sendingId, onInvite }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-2.5 ${highlight ? 'bg-violet-500/8' : ''}`}>
      {venue.image ? (
        <img src={venue.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink/8 text-ink-soft/60">
          <MapPin size={20} strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{venue.name}</p>
        <p className="truncate text-xs text-ink-soft/60">{[venue.category, venue.city].filter(Boolean).join(' · ')}</p>
        {reason && <p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-violet-600">{reason}</p>}
      </div>
      <button
        type="button"
        disabled={!!sendingId}
        onClick={() => onInvite(venue)}
        className="shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {sendingId === venue.id ? '…' : 'Inviter'}
      </button>
    </div>
  )
}

// "Idées de rendez-vous": the Coins Chics ranked for this match (lib/dateSpots.js);
// a tap sends the usual venue invite card in the chat.
function DateSpotSheet({ me, them, onClose, onInvite }) {
  const [venues, setVenues] = useState(null)
  const [sendingId, setSendingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchPublishedVenues()
      .then((list) => !cancelled && setVenues(list))
      .catch(() => !cancelled && setVenues([]))
    return () => {
      cancelled = true
    }
  }, [])
  const spots = useMemo(() => (venues ? rankDateSpots(venues, me, them) : null), [venues, me, them])

  async function invite(venue) {
    setSendingId(venue.id)
    try {
      await onInvite(venue)
      onClose()
    } finally {
      setSendingId(null)
    }
  }

  const top = spots?.slice(0, RECOMMENDED).filter((s) => s.score > 0) || []
  const rest = spots?.slice(top.length) || []

  return (
    <Modal onClose={onClose} className="!max-w-md !p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Idées de rendez-vous</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/5"
          aria-label="Fermer"
        >
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink-soft/70">
        Nos Coins Chics pour un premier rendez-vous avec {them?.firstName || 'votre match'}, dans un lieu public.
      </p>

      <div className="mt-3 max-h-[60svh] space-y-1 overflow-y-auto">
        {!spots ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : spots.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft/60">Aucun Coin Chic pour le moment.</p>
        ) : (
          <>
            {top.length > 0 && (
              <p className="flex items-center gap-1 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-violet-600">
                <Sparkles size={12} strokeWidth={2.5} />
                Pour vous deux
              </p>
            )}
            {top.map((s) => (
              <Row key={s.venue.id} venue={s.venue} reason={s.reason} highlight sendingId={sendingId} onInvite={invite} />
            ))}
            {rest.length > 0 && top.length > 0 && (
              <p className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/60">Autres lieux</p>
            )}
            {rest.map((s) => (
              <Row key={s.venue.id} venue={s.venue} reason={s.reason} sendingId={sendingId} onInvite={invite} />
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

export default DateSpotSheet
