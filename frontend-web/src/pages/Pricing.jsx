import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import badgeVip from '../assets/hbdo.jpeg'
import badgeDiamant from '../assets/mensuel.jpeg'
import badgeJade from '../assets/annuel.jpeg'

const TIERS = [
  {
    badge: badgeVip,
    emoji: '👑',
    name: 'VIP',
    tagline: 'Pour découvrir Premium',
    highlight: false,
    headerClass: 'bg-gradient-to-br from-[#C9962B]/25 to-[#C9962B]/5',
    checkClass: 'bg-[#C9962B] text-white',
    prices: [
      { period: 'Hebdomadaire', amount: '1 000 FCFA', note: "prix d'entrée" },
      { period: 'Mensuel', amount: '3 500 FCFA', note: '≈ 12,5 % d\'économie vs 4 semaines' },
      { period: 'Annuel', amount: '35 000 FCFA', note: '≈ 2 mois offerts' },
    ],
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
    headerClass: 'bg-gradient-to-br from-[#7A0F1E]/20 to-[#7A0F1E]/5',
    checkClass: 'bg-[#7A0F1E] text-white',
    prices: [
      { period: 'Mensuel', amount: '7 500 FCFA', note: null },
      { period: 'Annuel', amount: '75 000 FCFA', note: '≈ 2 mois offerts' },
    ],
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
    headerClass: 'bg-gradient-to-br from-[#1F3D2B]/20 to-[#1F3D2B]/5',
    checkClass: 'bg-[#1F3D2B] text-white',
    prices: [{ period: 'Annuel', amount: '125 000 FCFA', note: 'engagement longue durée' }],
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

function Pricing() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-10 sm:pt-40">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Nos tarifs</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">
            Passe au niveau supérieur
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#6b5d4f]">
            BomaVibes reste gratuit pour matcher et discuter. Choisis le niveau Premium qui te
            correspond, sans engagement caché.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm ${
                tier.highlight
                  ? 'border-[#C9962B] shadow-lg shadow-[#C9962B]/10 sm:-translate-y-3'
                  : 'border-[#1F3D2B]/8'
              }`}
            >
              {tier.highlight && (
                <span className="absolute right-5 top-5 z-10 rounded-full bg-[#C9962B] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#2B1D14]">
                  Populaire
                </span>
              )}

              {/* Header */}
              <div className={`px-8 pb-7 pt-8 text-center ${tier.headerClass}`}>
                <img src={tier.badge} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-md" />
                <h3 className="mt-5 font-display text-xl font-bold text-[#2B1D14]">
                  {tier.emoji} {tier.name}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6b5d4f]">{tier.tagline}</p>
              </div>

              {/* Prices */}
              <div className="space-y-3 px-8 py-6">
                {tier.prices.map((p) => (
                  <div key={p.period} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-[#6b5d4f]">{p.period}</span>
                    <div className="text-right">
                      <span className="font-display text-base font-bold text-[#2B1D14]">{p.amount}</span>
                      {p.note && <p className="text-[11px] text-[#9c7220]">{p.note}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div className="border-t border-[#1F3D2B]/8 px-8 py-6">
                {tier.intro && <p className="mb-4 text-sm font-semibold text-[#2B1D14]">{tier.intro}</p>}
                <ul className="space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tier.checkClass}`}>
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="text-sm leading-relaxed text-[#6b5d4f]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-8 pb-8">
                <Link
                  to="/signup"
                  className={`block rounded-xl py-3 text-center text-sm font-semibold transition ${
                    tier.highlight
                      ? 'bg-[#C9962B] text-[#2B1D14] shadow-lg hover:bg-[#dba838]'
                      : 'border border-[#1F3D2B]/20 text-[#1F3D2B] hover:bg-[#1F3D2B]/5'
                  }`}
                >
                  Choisir {tier.name}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-sm text-[#6b5d4f]">
            Pas encore prêt·e à passer Premium ? Profite gratuitement de toutes les fonctionnalités essentielles.
          </p>
          <Link
            to="/signup"
            className="mt-4 inline-block rounded-xl bg-[#1F3D2B] px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#2a5138]"
          >
            S'inscrire gratuitement
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Pricing
