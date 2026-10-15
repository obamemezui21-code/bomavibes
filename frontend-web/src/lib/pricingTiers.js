// Subscription tiers shown on the pricing page, the landing page and the
// Discover teaser — plain data, kept out of the PricingTiers component file.
import badgeVip from '../assets/hbdo.webp'
import badgeDiamant from '../assets/mensuel.webp'
import badgeJade from '../assets/annuel.webp'

// Durations on sale, mirrored from PLAN_DURATIONS in
// backend/src/config/plans.js (which also holds the prices actually charged).
const DURATIONS = [
  { id: 'week', period: 'Hebdomadaire', months: 0 },
  { id: 'month', period: 'Mensuel', months: 1 },
  { id: 'semester', period: 'Semestriel', months: 6 },
  { id: 'year', period: 'Annuel', months: 12 },
]

const fcfa = (n) => `${n.toLocaleString('fr-FR').replace(/s/g, ' ')} FCFA`

// { week, month, semester, year } in FCFA → the price rows, long durations
// showing their saving against paying monthly.
function pricesOf(amounts) {
  return DURATIONS.map(({ id, period, months }) => {
    const saving = months > 1 ? Math.round((1 - amounts[id] / (amounts.month * months)) * 100) : 0
    return { id, period, amount: fcfa(amounts[id]), note: saving > 0 ? `Économisez ${saving} %` : null }
  })
}

// Only perks that exist: a plan never advertises a feature not built yet,
// nor one every member already has for free (messages, for instance). What
// each plan really unlocks is enforced by the backend
// (backend/src/config/plans.js); keep this copy consistent with it.
export const TIERS = [
  {
    badge: badgeVip,
    emoji: '👑',
    id: 'vip',
    name: 'VIP',
    tagline: 'Pour découvrir Premium',
    highlight: false,
    headerClass: 'bg-gradient-to-br from-pink-500/25 to-pink-500/5',
    checkClass: 'bg-pink-500 text-white',
    prices: pricesOf({ week: 990, month: 2990, semester: 14990, year: 27990 }),
    intro: null,
    features: [
      'Likes illimités',
      'Voir qui vous aime',
      'Appels audio & vidéo',
      'Boost 1×/semaine',
      '5 Super Likes/semaine',
      'Priorité de visibilité élevée',
    ],
  },
  {
    badge: badgeDiamant,
    emoji: '💎',
    id: 'diamant',
    name: 'Diamant Rouge',
    tagline: 'Notre offre premium',
    highlight: true,
    headerClass: 'bg-gradient-to-br from-coral-600/20 to-coral-600/5',
    checkClass: 'bg-coral-600 text-white',
    prices: pricesOf({ week: 1990, month: 5990, semester: 29990, year: 55990 }),
    intro: 'Tout VIP, plus :',
    features: [
      'Boost 3×/semaine',
      '3 Super Likes/jour',
      'Priorité de visibilité très élevée',
    ],
  },
  {
    badge: badgeJade,
    emoji: '💚',
    id: 'jade',
    name: 'Jadéite Impériale',
    tagline: "L'offre ultra-premium, pour l'exclusivité",
    highlight: false,
    headerClass: 'bg-gradient-to-br from-violet-600/20 to-violet-600/5',
    checkClass: 'bg-violet-600 text-white',
    prices: pricesOf({ week: 3490, month: 9990, semester: 49990, year: 94990 }),
    intro: 'Tout Diamant Rouge, plus :',
    features: [
      'Boost 1×/jour',
      '10 Super Likes/jour',
      'Mode invisible',
      'Priorité de visibilité maximale',
    ],
  },
]
