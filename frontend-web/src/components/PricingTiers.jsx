import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { TIERS } from '../lib/pricingTiers.js'

function PricingTiers() {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm ${
            tier.highlight ? 'border-pink-500 shadow-lg shadow-pink-500/10 sm:-translate-y-3' : 'border-violet-600/8'
          }`}
        >
          {tier.highlight && (
            <span className="absolute right-5 top-5 z-10 rounded-full bg-pink-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#261b28]">
              Populaire
            </span>
          )}

          {/* Header */}
          <div className={`px-8 pb-7 pt-8 text-center ${tier.headerClass}`}>
            <img src={tier.badge} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-md" />
            <h3 className="mt-5 font-display text-xl font-bold text-[#261b28]">
              {tier.emoji} {tier.name}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#635a65]">{tier.tagline}</p>
          </div>

          {/* Prices */}
          <div className="space-y-3 px-8 py-6">
            {tier.prices.map((p) => (
              <div key={p.period} className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-[#635a65]">{p.period}</span>
                <div className="text-right">
                  <span className="font-display text-base font-bold text-[#261b28]">{p.amount}</span>
                  {p.note && <p className="text-[11px] text-pink-600">{p.note}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="border-t border-violet-600/8 px-8 py-6">
            {tier.intro && <p className="mb-4 text-sm font-semibold text-[#261b28]">{tier.intro}</p>}
            <ul className="space-y-3">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tier.checkClass}`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-[#635a65]">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-8 pb-8">
            <Link
              to="/signup"
              className={`block rounded-xl py-3 text-center text-sm font-semibold transition ${
                tier.highlight
                  ? 'bg-pink-500 text-[#261b28] shadow-lg hover:bg-pink-400'
                  : 'border border-violet-600/20 text-violet-600 hover:bg-violet-600/5'
              }`}
            >
              Choisir {tier.name}
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

export default PricingTiers
