// Subscription tiers shown on the pricing page, the landing page and the
// Discover teaser — plain data, kept out of the PricingTiers component file.
import badgeVip from '../assets/hbdo.webp'
import badgeDiamant from '../assets/mensuel.webp'
import badgeJade from '../assets/annuel.webp'

export const TIERS = [
  {
    badge: badgeVip,
    emoji: '👑',
    name: 'VIP',
    tagline: 'Pour découvrir Premium',
    highlight: false,
    headerClass: 'bg-gradient-to-br from-pink-500/25 to-pink-500/5',
    checkClass: 'bg-pink-500 text-white',
    prices: [{ period: 'Mensuel', amount: '2 000 FCFA', note: null }],
    intro: null,
    features: [
      'Likes illimités',
      'Voir qui vous aime',
      'Messages illimités',
      'Appels audio & vidéo',
      'Boost 1×/semaine',
      '5 Super Likes/semaine',
      'Priorité de visibilité élevée',
    ],
  },
  {
    badge: badgeDiamant,
    emoji: '💎',
    name: 'Diamant Rouge',
    tagline: 'Notre offre premium',
    highlight: true,
    headerClass: 'bg-gradient-to-br from-coral-600/20 to-coral-600/5',
    checkClass: 'bg-coral-600 text-white',
    prices: [{ period: 'Mensuel', amount: '3 500 FCFA', note: null }],
    intro: 'Tout VIP, plus :',
    features: [
      'Boost 3×/semaine',
      '3 Super Likes/jour',
      'Support prioritaire',
      'Priorité de visibilité très élevée',
    ],
  },
  {
    badge: badgeJade,
    emoji: '💚',
    name: 'Jadéite Impériale',
    tagline: "L'offre ultra-premium, pour l'exclusivité",
    highlight: false,
    headerClass: 'bg-gradient-to-br from-violet-600/20 to-violet-600/5',
    checkClass: 'bg-violet-600 text-white',
    prices: [{ period: 'Mensuel', amount: '5 500 FCFA', note: null }],
    intro: 'Tout Diamant Rouge, plus :',
    features: [
      'Boost 1×/jour',
      '10 Super Likes/jour',
      'Mode invisible',
      'Traduction automatique',
      'Concierge IA personnel',
      'Rooms exclusives',
      'Événements exclusifs',
      'Support Premium 24/7',
      'Priorité de visibilité maximale',
    ],
  },
]
