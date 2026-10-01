import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Crown, X } from 'lucide-react'
import NgoriCoin from './NgoriCoin.jsx'

// Limits a Ngori reward can lift for a while (see lib/ngori.js).
const NGORI_REASONS = ['likes', 'calls', 'likers', 'boost']

const REASONS = {
  likes: {
    title: 'Plus de likes pour aujourd’hui',
    perks: ['Likes illimités', 'Voir qui vous aime', 'Appels audio & vidéo'],
  },
  superlikes: {
    title: 'Plus de Super Likes pour le moment',
    perks: ['Jusqu’à 10 Super Likes par jour', 'Boost de votre profil', 'Priorité de visibilité'],
  },
  calls: {
    title: 'Les appels sont réservés aux abonnés',
    perks: ['Appels audio & vidéo avec vos matchs', 'Likes illimités', 'Voir qui vous aime'],
  },
  likers: {
    title: 'Découvrez qui vous a aimé·e',
    perks: ['Voir qui vous aime', 'Matcher en un geste', 'Likes illimités'],
  },
  boost: {
    title: 'Mettez votre profil en avant',
    perks: ['Boost : en tête de Discover pendant 30 min', 'Priorité de visibilité', 'Plus de Super Likes'],
  },
}

// "Passez Premium" sheet shown when a free account hits a limit or a
// subscriber-only feature. `message` (e.g. the server's quota message)
// replaces the default title when given.
function PaywallModal({ reason = 'likes', message, onClose }) {
  const navigate = useNavigate()
  const copy = REASONS[reason] || REASONS.likes

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-t-[28px] bg-violet-950 p-6 text-white md:rounded-[28px]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-heart-500 text-white">
          <Crown size={24} strokeWidth={2.25} />
        </span>
        <h2 id="paywall-title" className="mt-4 font-display text-xl font-bold">
          {message || copy.title}
        </h2>
        <p className="mt-1 text-sm text-white/70">Avec un forfait BomaVibes, dès 2 000 FCFA par mois :</p>
        <ul className="mt-4 space-y-2">
          {copy.perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-heart-400" />
              {p}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigate('/tarifs')}
          className="mt-6 w-full rounded-full bg-white py-3 text-sm font-semibold text-violet-950 transition hover:bg-white/90"
        >
          Voir les forfaits
        </button>
        {NGORI_REASONS.includes(reason) && (
          <button
            type="button"
            onClick={() => navigate('/ngori')}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/25 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <NgoriCoin size={18} />
            Débloquer avec mes Ngori
          </button>
        )}
        <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm text-white/70 hover:text-white">
          Plus tard
        </button>
      </motion.div>
    </motion.div>
  )
}

export default PaywallModal
