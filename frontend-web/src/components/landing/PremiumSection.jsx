import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'
import { ArrowRight, Check, Crown, Eye, Rocket, Star } from 'lucide-react'
import { TIERS } from '../../lib/pricingTiers.js'


// Figures mirror lib/plans.js (itself a copy of backend/src/config/plans.js,
// which is what's enforced) — keep them in sync when a tier changes.
const HIGHLIGHTS = [
  {
    icon: Rocket,
    title: 'Boost',
    text: 'Passez en tête de Découvrir pendant 30 minutes et multipliez les regards sur votre profil.',
    glow: 'from-[#f2bf4e] to-[#f2726c]',
  },
  {
    icon: Star,
    title: 'Super Like',
    text: 'Démarquez-vous : un Super Like montre à quelqu’un qu’il ou elle vous plaît vraiment. Jusqu’à 10 par jour.',
    glow: 'from-sky-400 to-violet-500',
  },
  {
    icon: Crown,
    title: 'VIP & plus',
    text: 'Likes illimités, voir qui vous aime, appels audio & vidéo, et le mode invisible avec Jadéite Impériale.',
    glow: 'from-pink-500 to-violet-500',
  },
]

const FREE_FOREVER = ['Créer votre profil', 'Matcher et discuter', '20 likes par jour', '1 Super Like par semaine', 'Recevoir des appels']

function PremiumSection() {
  return (
    <section id="tarifs" className="relative isolate scroll-mt-20 overflow-hidden px-4 py-24 sm:px-8 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#f7f1e6] via-[#f3e6f1] to-[#f7f1e6]" />
      <div className="mx-auto max-w-6xl">
        <Reveal
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Premium</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-[#261b28] sm:text-5xl">
            Donnez un coup d'accélérateur à vos rencontres
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#635a65] sm:text-lg">
            L'essentiel reste gratuit. Premium, c'est pour celles et ceux qui veulent être vus plus, plus vite.
          </p>
        </Reveal>

        {/* Highlights */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {HIGHLIGHTS.map((h, i) => (
            <Reveal
              key={h.title} delay={i * 0.08}
              className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-violet-600/8 transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-900/10"
            >
              <div
                aria-hidden="true"
                className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${h.glow} opacity-20 blur-2xl transition duration-500 group-hover:opacity-40`}
              />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${h.glow} text-white shadow-lg`}>
                <h.icon size={22} />
              </span>
              <h3 className="relative mt-5 font-display text-xl font-bold text-[#261b28]">{h.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-[#635a65]">{h.text}</p>
            </Reveal>
          ))}
        </div>

        {/* Plans + free tier */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:gap-6">
          <Reveal
            className="rounded-3xl bg-[#1c1024] p-5 text-white shadow-xl sm:p-7"
          >
            <p className="font-display text-lg font-bold">Nos forfaits</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {TIERS.map((tier) => (
                <Link
                  key={tier.id}
                  to="/tarifs"
                  className={`group relative flex items-center gap-3 rounded-2xl p-3 transition duration-300 hover:-translate-y-0.5 sm:flex-col sm:p-4 sm:text-center ${
                    tier.highlight ? 'bg-gradient-to-br from-pink-500/30 to-violet-500/20 ring-1 ring-pink-400/50' : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {tier.highlight && (
                    <span className="absolute right-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                      Populaire
                    </span>
                  )}
                  <img src={tier.badge} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover shadow sm:h-14 sm:w-14" />
                  <div className="min-w-0">
                    <p className="font-bold">
                      {tier.emoji} {tier.name}
                    </p>
                    <p className="text-sm text-white/70">
                      <span className="font-semibold text-white">{tier.prices[0].amount}</span> / mois
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-white/60">Paiement Airtel Money ou Moov Money, sans engagement.</p>
              <Link
                to="/tarifs"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#4b164c] transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Comparer les forfaits
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.1}
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-violet-600/8 sm:p-7"
          >
            <p className="flex items-center gap-2 font-display text-lg font-bold text-[#261b28]">
              <Eye size={18} className="text-violet-600" /> Toujours gratuit
            </p>
            <ul className="mt-4 space-y-2.5">
              {FREE_FOREVER.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[#261b28]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-600">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default PremiumSection
