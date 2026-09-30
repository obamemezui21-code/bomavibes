import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MessageCircle, X } from 'lucide-react'
import { TIERS } from '../lib/pricingTiers.js'
import { useAuth } from '../context/AuthContext.jsx'

// Official WhatsApp line (same as the help widget).
const WHATSAPP_NUMBER = '33744233809'

// Online payment isn't wired up yet: a signed-in user asks the team on
// WhatsApp (message pre-filled with the plan and their account email), pays
// by Mobile Money, and an admin activates the plan (Admin → Utilisateurs).
function SubscribeSheet({ tier, email, onClose }) {
  const price = tier.prices[0]
  const text = `Bonjour BomaVibes, je souhaite activer le forfait ${tier.name} (${price.amount} / ${price.period.toLowerCase()}). Mon e-mail de compte : ${email || '—'}`
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-title"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-t-[28px] bg-white p-6 text-left md:rounded-[28px]"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-[#635a65]" aria-label="Fermer">
          <X size={18} />
        </button>
        <h3 id="subscribe-title" className="font-display text-xl font-bold text-[#261b28]">
          {tier.emoji} Activer {tier.name}
        </h3>
        <p className="mt-1 text-sm text-[#635a65]">
          {price.amount} / {price.period.toLowerCase()}
        </p>
        <ol className="mt-4 space-y-2 text-sm text-[#261b28]">
          <li>1. Écrivez-nous sur WhatsApp (message déjà rempli).</li>
          <li>2. Nous vous indiquons comment payer par Mobile Money.</li>
          <li>3. Votre forfait est activé sur votre compte : vous recevez une notification.</li>
        </ol>
        <p className="mt-3 text-xs text-[#635a65]">Le paiement directement dans l'app arrive bientôt.</p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#4b164c] py-3 text-sm font-semibold text-white transition hover:bg-[#4b164c]/90"
        >
          <MessageCircle size={17} strokeWidth={2.25} />
          Continuer sur WhatsApp
        </a>
      </motion.div>
    </motion.div>
  )
}

function PricingTiers() {
  const { user } = useAuth()
  const [chosen, setChosen] = useState(null)
  return (
    <>
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm ${
            tier.highlight ? 'border-pink-500 shadow-lg shadow-pink-500/10 sm:-translate-y-3' : 'border-violet-600/8'
          }`}
        >
          {tier.highlight && (
            <span className="absolute right-5 top-5 z-10 rounded-full bg-pink-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
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
            {user ? (
              <button
                type="button"
                onClick={() => setChosen(tier)}
                className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-pink-500 text-white shadow-lg hover:bg-pink-400'
                    : 'border border-violet-600/20 text-violet-600 hover:bg-violet-600/5'
                }`}
              >
                Choisir {tier.name}
              </button>
            ) : (
              <Link
                to="/signup"
                className={`block rounded-xl py-3 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-pink-500 text-white shadow-lg hover:bg-pink-400'
                    : 'border border-violet-600/20 text-violet-600 hover:bg-violet-600/5'
                }`}
              >
                Choisir {tier.name}
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
    <AnimatePresence>
      {chosen && <SubscribeSheet tier={chosen} email={user?.email} onClose={() => setChosen(null)} />}
    </AnimatePresence>
    </>
  )
}

export default PricingTiers
