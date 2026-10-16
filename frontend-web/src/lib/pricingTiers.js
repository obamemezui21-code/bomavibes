// Subscription tiers shown on the pricing page, the landing page and the
// Discover teaser — plain data, kept out of the PricingTiers component file.
import badgeVip from '../assets/hbdo.webp'
import badgeDiamant from '../assets/mensuel.webp'
import badgeJade from '../assets/annuel.webp'

// Durations on sale, mirrored from PLAN_DURATIONS in
// backend/src/config/plans.js (which also holds the prices actually charged).
const DURATIONS = [
  { id: 'week', period: 'Hebdomadaire', unit: 'semaine', days: 7, months: 0 },
  { id: 'month', period: 'Mensuel', unit: 'mois', days: 30, months: 1 },
  { id: 'semester', period: 'Semestriel', unit: '6 mois', days: 182, months: 6 },
  { id: 'year', period: 'Annuel', unit: 'an', days: 365, months: 12 },
]

// Non-breaking spaces so "27 990 FCFA" never wraps mid-amount.
const NBSP = String.fromCharCode(0xa0)
const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/\s/g, NBSP)}${NBSP}FCFA`

// { week, month, semester, year } in FCFA → the price rows: the amount, what
// it comes to per day (per month for long durations) and, for 6 months and
// a year, the saving against paying month by month.
function pricesOf(amounts) {
  return DURATIONS.map(({ id, period, unit, days, months }) => {
    const amount = amounts[id]
    const perUnit = months > 1 ? `soit ${fcfa(amount / months)} / mois` : `soit ${fcfa(amount / days)} / jour`
    const savedFcfa = months > 1 ? amounts.month * months - amount : 0
    const savedPercent = savedFcfa > 0 ? Math.round((savedFcfa / (amounts.month * months)) * 100) : 0
    return {
      id,
      period,
      unit,
      amount: fcfa(amount),
      detail: perUnit,
      note: savedFcfa > 0 ? `Économisez ${fcfa(savedFcfa)} (−${savedPercent} %)` : null,
    }
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
