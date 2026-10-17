import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Moon } from 'lucide-react'
import DiscoverProfileCard from './DiscoverProfileCard.jsx'
import { timeUntilTomorrow } from '../lib/dailySelection.js'

// Discover's "Sélection" tab (slow dating): today's few profiles, then a
// countdown until tomorrow's.
function DailySelection({ selection, matchPercentFor, onOpen }) {
  const [countdown, setCountdown] = useState(() => timeUntilTomorrow())
  useEffect(() => {
    const t = setInterval(() => setCountdown(timeUntilTomorrow()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { ids, remaining } = selection
  const done = ids.length - remaining.length

  return (
    <div className="w-full">
      <div className="px-1">
        <h2 className="font-display text-base font-semibold text-ink">Ma sélection du jour</h2>
        <p className="mt-0.5 text-xs text-ink-soft/70">
          {ids.length
            ? `${ids.length > 1 ? `${ids.length} profils choisis` : "1 profil choisi"} pour toi, pour prendre le temps · ${done}/${ids.length} fait${done > 1 ? "s" : ""}.`
            : 'Pas encore assez de profils pour composer ta sélection.'}
        </p>
      </div>

      {remaining.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <AnimatePresence mode="popLayout">
            {remaining.map((p, i) => (
              <DiscoverProfileCard
                key={p.id}
                profile={p}
                index={i}
                matchPercent={matchPercentFor(p)}
                onOpen={() => onOpen(p)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass-panel mt-4 flex flex-col items-center gap-2 rounded-[28px] p-8 text-center">
          <Moon size={36} strokeWidth={1.5} className="text-violet-500" />
          <p className="font-display text-base font-semibold text-ink">
            {ids.length ? 'Tu as fait le tour de ta sélection 🌙' : 'Reviens demain 🌙'}
          </p>
          <p className="max-w-xs text-sm text-ink-soft/70">Nouvelle sélection dans {countdown}.</p>
        </div>
      )}

      {remaining.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-soft/50">Nouvelle sélection dans {countdown}</p>
      )}
    </div>
  )
}

export default DailySelection
