import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import badgeVip from '../assets/hbdo.jpeg'
import badgeDiamant from '../assets/mensuel.jpeg'
import badgeJade from '../assets/annuel.jpeg'

const COLUMNS = [
  { key: 'free', label: 'Gratuit', emoji: null, headerClass: 'bg-[#1F3D2B]/5 text-[#2B1D14]' },
  { key: 'vip', label: 'VIP', emoji: '👑', headerClass: 'bg-[#C9962B]/15 text-[#9c7220]' },
  { key: 'diamant', label: 'Diamant Rouge', emoji: '💎', headerClass: 'bg-[#7A0F1E]/10 text-[#7A0F1E]' },
  { key: 'jade', label: 'Jadéite Impériale', emoji: '💚', headerClass: 'bg-[#1F3D2B]/10 text-[#1F3D2B]' },
]

const FEATURE_ROWS = [
  { label: 'Likes', values: ['20/jour', 'Illimités', 'Illimités', 'Illimités'] },
  { label: 'Voir qui vous aime', values: [false, true, true, true] },
  { label: 'Messages', values: ['Limités', 'Illimités', 'Illimités', 'Illimités'] },
  { label: 'Appels audio', values: [false, true, true, true] },
  { label: 'Appels vidéo', values: [false, true, true, true] },
  { label: 'Boost', values: [false, '1/semaine', '3/semaine', '1/jour'] },
  { label: 'Super Likes', values: ['1/semaine', '5/semaine', '3/jour', '10/jour'] },
  { label: 'Mode invisible', values: [false, false, false, true] },
  { label: 'Traduction', values: [false, false, false, true] },
  { label: 'Concierge IA', values: [false, false, false, true] },
  { label: 'Rooms', values: [false, false, false, 'Exclusif'] },
  { label: 'Événements', values: [false, false, false, 'Exclusif'] },
  { label: 'Badge', values: ['Standard', 'VIP', 'Diamant Rouge', 'Jadéite Impériale'] },
  { label: 'Support', values: ['Standard', 'Standard', 'Prioritaire', 'Premium 24/7'] },
  { label: 'Priorité de visibilité', values: ['Normale', 'Élevée', 'Très élevée', 'Maximale'] },
]

const TIERS = [
  {
    badge: badgeVip,
    emoji: '👑',
    name: 'VIP',
    tagline: "Pour découvrir Premium",
    highlight: false,
    prices: [
      { period: 'Hebdomadaire', amount: '1 000 FCFA', note: "prix d'entrée" },
      { period: 'Mensuel', amount: '3 500 FCFA', note: '≈ 12,5 % d\'économie vs 4 semaines' },
      { period: 'Annuel', amount: '35 000 FCFA', note: '≈ 2 mois offerts' },
    ],
  },
  {
    badge: badgeDiamant,
    emoji: '💎',
    name: 'Diamant Rouge',
    tagline: 'Notre offre premium',
    highlight: true,
    prices: [
      { period: 'Mensuel', amount: '7 500 FCFA', note: null },
      { period: 'Annuel', amount: '75 000 FCFA', note: '≈ 2 mois offerts' },
    ],
  },
  {
    badge: badgeJade,
    emoji: '💚',
    name: 'Jadéite Impériale',
    tagline: 'L\'offre ultra-premium, pour l\'exclusivité',
    highlight: false,
    prices: [{ period: 'Annuel', amount: '125 000 FCFA', note: 'engagement longue durée' }],
  },
]

function Pricing() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-10 sm:pt-40">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Premium</p>
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
              className={`relative rounded-3xl border p-8 shadow-sm ${
                tier.highlight
                  ? 'border-[#C9962B] bg-white shadow-lg shadow-[#C9962B]/10 sm:-translate-y-3'
                  : 'border-[#1F3D2B]/8 bg-white'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C9962B] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#2B1D14]">
                  Le plus populaire
                </span>
              )}

              <img src={tier.badge} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-md" />
              <h3 className="mt-5 text-center font-display text-xl font-bold text-[#2B1D14]">
                {tier.emoji} {tier.name}
              </h3>
              <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-[#9c7220]">
                {tier.tagline}
              </p>

              <div className="mt-6 space-y-3 border-t border-[#1F3D2B]/8 pt-6">
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

              <Link
                to="/signup"
                className={`mt-7 block rounded-xl py-3 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-[#C9962B] text-[#2B1D14] shadow-lg hover:bg-[#dba838]'
                    : 'border border-[#1F3D2B]/20 text-[#1F3D2B] hover:bg-[#1F3D2B]/5'
                }`}
              >
                Choisir {tier.name}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-24">
          <h2 className="text-center font-display text-2xl font-bold text-[#2B1D14] sm:text-3xl">
            Comparer tous les plans
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-[#1F3D2B]/8 bg-white shadow-sm">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white p-4 text-left font-display text-sm font-bold text-[#2B1D14]">
                    Fonctionnalités
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={`p-4 text-center font-display text-sm font-bold ${c.headerClass}`}>
                      {c.emoji && <span className="mr-1">{c.emoji}</span>}
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-[#1F3D2B]/[0.025]' : undefined}>
                    <td className="sticky left-0 bg-inherit p-4 font-medium text-[#2B1D14]">{row.label}</td>
                    {row.values.map((v, ci) => (
                      <td key={COLUMNS[ci].key} className="p-4 text-center text-[#6b5d4f]">
                        {v === true ? (
                          <Check size={18} strokeWidth={2.5} className="mx-auto text-[#1F3D2B]" />
                        ) : v === false ? (
                          <X size={18} strokeWidth={2.5} className="mx-auto text-[#6b5d4f]/30" />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
