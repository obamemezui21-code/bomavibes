import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCircle2, Loader2, MessageCircle, Smartphone, X } from 'lucide-react'
import { TIERS } from '../lib/pricingTiers.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getPayment, getPaymentConfig, startMobileMoneyPayment } from '../firebase/subscriptions.js'

// Official WhatsApp line (same as the help widget).
const WHATSAPP_NUMBER = '33744233809'

const POLL_INTERVAL_MS = 4000
// How long the sheet keeps polling; the backend keeps checking after that
// and the user still gets a push notification once the plan is active.
const POLL_TIMEOUT_MS = 3 * 60 * 1000

function WhatsAppLink({ tier, email, className, children }) {
  const price = tier.prices[0]
  const text = `Bonjour BomaVibes, je souhaite activer le forfait ${tier.name} (${price.amount} / ${price.period.toLowerCase()}). Mon e-mail de compte : ${email || '—'}`
  return (
    <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

// In-app Mobile Money (SingPay — Airtel Money / Moov Money, Gabon): the user
// enters their number, confirms the USSD prompt on their phone with their
// PIN, and the backend activates the plan once SingPay confirms. Outside
// Gabon, or while SingPay isn't configured, the WhatsApp flow remains: the
// team takes the payment and an admin activates the plan.
function SubscribeSheet({ tier, email, mobileMoney, onClose }) {
  const price = tier.prices[0]
  const [phone, setPhone] = useState('')
  // 'form' | 'sending' | 'waiting' | 'paid' | 'failed' | 'slow'
  const [step, setStep] = useState('form')
  const [error, setError] = useState('')
  const [paidUntil, setPaidUntil] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => () => clearTimeout(pollRef.current), [])

  const poll = (reference, startedAt) => {
    pollRef.current = setTimeout(async () => {
      try {
        const p = await getPayment(reference)
        if (p.status === 'paid') {
          setPaidUntil(p.planExpiresAt)
          setStep('paid')
          return
        }
        if (p.status === 'failed' || p.status === 'expired') {
          setError(p.message || 'Le paiement n’a pas abouti.')
          setStep('failed')
          return
        }
      } catch {
        // Network hiccup: keep polling until the timeout.
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) setStep('slow')
      else poll(reference, startedAt)
    }, POLL_INTERVAL_MS)
  }

  const pay = async (e) => {
    e.preventDefault()
    setError('')
    setStep('sending')
    try {
      const p = await startMobileMoneyPayment(tier.id, phone)
      setStep('waiting')
      poll(p.reference, Date.now())
    } catch (err) {
      setError(err.message)
      setStep('failed')
    }
  }

  const whatsappClass =
    'mt-5 flex items-center justify-center gap-2 rounded-full bg-[#4b164c] py-3 text-sm font-semibold text-white transition hover:bg-[#4b164c]/90'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center md:p-6"
      onClick={step === 'sending' ? undefined : onClose}
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

        {!mobileMoney && (
          <>
            <ol className="mt-4 space-y-2 text-sm text-[#261b28]">
              <li>1. Écrivez-nous sur WhatsApp (message déjà rempli).</li>
              <li>2. Nous vous indiquons comment payer par Mobile Money.</li>
              <li>3. Votre forfait est activé sur votre compte : vous recevez une notification.</li>
            </ol>
            <WhatsAppLink tier={tier} email={email} className={whatsappClass}>
              <MessageCircle size={17} strokeWidth={2.25} />
              Continuer sur WhatsApp
            </WhatsAppLink>
          </>
        )}

        {mobileMoney && (step === 'form' || step === 'sending') && (
          <form onSubmit={pay} className="mt-4">
            <label htmlFor="momo-phone" className="text-sm font-semibold text-[#261b28]">
              Numéro Airtel Money ou Moov Money
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-600/20 px-3 focus-within:border-violet-600">
              <span className="text-sm text-[#635a65]">+241</span>
              <input
                id="momo-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="074 12 34 56"
                className="w-full bg-transparent py-3 text-sm text-[#261b28] outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-[#635a65]">
              Vous recevrez une demande de paiement sur ce téléphone : validez-la avec votre code secret.
            </p>
            <button
              type="submit"
              disabled={step === 'sending'}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 py-3 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:opacity-60"
            >
              {step === 'sending' ? <Loader2 size={17} className="animate-spin" /> : <Smartphone size={17} strokeWidth={2.25} />}
              Payer {price.amount}
            </button>
            <WhatsAppLink tier={tier} email={email} className="mt-4 block text-center text-xs font-semibold text-violet-600 underline">
              Hors du Gabon ? Payer via WhatsApp
            </WhatsAppLink>
          </form>
        )}

        {step === 'waiting' && (
          <div className="mt-6 flex flex-col items-center text-center">
            <Loader2 size={36} className="animate-spin text-pink-500" />
            <p className="mt-4 text-sm font-semibold text-[#261b28]">Validez le paiement sur votre téléphone</p>
            <p className="mt-1 text-xs text-[#635a65]">
              Entrez votre code secret Mobile Money dans la fenêtre qui s’est ouverte. Cette page se met à jour toute seule.
            </p>
          </div>
        )}

        {step === 'slow' && (
          <div className="mt-6 text-center">
            <p className="text-sm font-semibold text-[#261b28]">Paiement toujours en attente</p>
            <p className="mt-1 text-xs text-[#635a65]">
              Si vous l’avez validé, votre forfait sera activé automatiquement et vous recevrez une notification. Vous pouvez fermer
              cette fenêtre.
            </p>
          </div>
        )}

        {step === 'paid' && (
          <div className="mt-6 flex flex-col items-center text-center">
            <CheckCircle2 size={40} className="text-mint-500" />
            <p className="mt-3 text-sm font-semibold text-[#261b28]">Paiement réussi, forfait {tier.name} activé 🎉</p>
            {paidUntil && (
              <p className="mt-1 text-xs text-[#635a65]">
                Actif jusqu’au {new Date(paidUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            )}
            <button type="button" onClick={onClose} className={`${whatsappClass} w-full`}>
              Profiter de mes avantages
            </button>
          </div>
        )}

        {step === 'failed' && (
          <div className="mt-6 text-center">
            <p className="text-sm font-semibold text-coral-600">{error || 'Le paiement n’a pas abouti.'}</p>
            <button type="button" onClick={() => setStep('form')} className={`${whatsappClass} w-full`}>
              Réessayer
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function PricingTiers() {
  const { user } = useAuth()
  const [chosen, setChosen] = useState(null)
  const [mobileMoney, setMobileMoney] = useState(false)

  useEffect(() => {
    if (!user) return
    getPaymentConfig()
      .then((c) => setMobileMoney(!!c.singpay))
      .catch(() => {})
  }, [user])
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
      {chosen && <SubscribeSheet tier={chosen} email={user?.email} mobileMoney={mobileMoney} onClose={() => setChosen(null)} />}
    </AnimatePresence>
    </>
  )
}

export default PricingTiers
