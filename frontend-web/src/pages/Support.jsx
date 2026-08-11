import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bug,
  Cloud,
  Globe,
  HeartHandshake,
  Mail,
  Palette,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { CONTRIBUTION_AMOUNTS, PAYMENT_METHODS } from '../lib/paymentMethods.js'

const USES = [
  { Icon: Wrench, text: 'Développer de nouvelles fonctionnalités' },
  { Icon: ShieldCheck, text: 'Renforcer la sécurité et la protection des utilisateurs' },
  { Icon: Cloud, text: "Maintenir les serveurs et l'infrastructure" },
  { Icon: Globe, text: 'Déployer BomaVibes dans de nouveaux pays africains' },
  { Icon: Bug, text: 'Corriger les bugs et améliorer la stabilité' },
  { Icon: Palette, text: "Améliorer continuellement l'expérience utilisateur" },
]

const chipClass = (selected) =>
  `rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
    selected
      ? 'border-violet-400 bg-violet-500/15 text-violet-600'
      : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
  }`

function formatFcfa(n) {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

function Support() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [amount, setAmount] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [method, setMethod] = useState(null)
  const [email, setEmail] = useState('')
  const [isNotifying, setIsNotifying] = useState(false)
  const [notified, setNotified] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'campaign', 'current'), (snap) => {
      setCampaign(snap.exists() ? snap.data() : null)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    setEmail(user?.email || '')
  }, [user?.email])

  const effectiveAmount = amount === 'custom' ? Number(customAmount) || 0 : amount
  const progressPct = campaign?.goalAmount
    ? Math.min(100, Math.round((campaign.currentAmount / campaign.goalAmount) * 100))
    : 0

  function selectMethod(m) {
    if (!effectiveAmount) {
      showToast("Choisissez d'abord un montant.", 'info')
      return
    }
    setNotified(false)
    setMethod(m)
  }

  async function handleNotifyMe() {
    if (!method) return
    setIsNotifying(true)
    try {
      await addDoc(collection(db, 'contributionInterest'), {
        uid: user.id,
        amount: effectiveAmount,
        method: method.key,
        email: email || null,
        createdAt: serverTimestamp(),
      })
      setNotified(true)
    } catch {
      showToast("Impossible d'enregistrer votre demande, réessayez.", 'error')
    } finally {
      setIsNotifying(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-surface-soft p-6 pb-24 desktop:min-h-full desktop:pb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-coral-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-semibold text-ink">Construisons BomaVibes ensemble</h1>
        </div>

        <div className="glass-panel rounded-2xl p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-coral-500 to-violet-500 text-white shadow-md shadow-coral-500/30">
            <HeartHandshake size={22} strokeWidth={2} />
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">❤️ Construisons BomaVibes ensemble</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft/70">
            BomaVibes est développé avec la volonté de créer une plateforme de rencontre moderne, sécurisée et
            adaptée aux réalités africaines.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft/70">
            Si vous appréciez votre expérience, vous pouvez contribuer librement à l'évolution du projet. Chaque
            contribution nous aide à améliorer l'application, développer de nouvelles fonctionnalités et accueillir
            plus d'utilisateurs.
          </p>
        </div>

        {campaign?.goalAmount > 0 && (
          <div className="glass-panel mt-4 rounded-2xl p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-ink/80">Objectif du mois</span>
              <span className="font-semibold text-ink">
                {formatFcfa(campaign.currentAmount || 0)} / {formatFcfa(campaign.goalAmount)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-coral-500 to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}

        <div className="glass-panel mt-4 rounded-2xl p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Votre soutien nous aide à :</p>
          <ul className="space-y-3">
            {USES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                  <Icon size={15} strokeWidth={2} />
                </span>
                <span className="text-sm text-ink-soft/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel mt-4 rounded-2xl p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Choisissez un montant</p>
          <div className="grid grid-cols-3 gap-2">
            {CONTRIBUTION_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAmount(value)
                  setMethod(null)
                  setNotified(false)
                }}
                className={chipClass(amount === value)}
              >
                {formatFcfa(value)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAmount('custom')
                setMethod(null)
                setNotified(false)
              }}
              className={chipClass(amount === 'custom')}
            >
              Autre montant
            </button>
          </div>
          {amount === 'custom' && (
            <input
              type="number"
              min="100"
              placeholder="Montant en FCFA"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="mt-3 w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15"
            />
          )}
        </div>

        <div className="glass-panel mt-4 rounded-2xl p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Moyen de paiement</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => selectMethod(m)}
                className={chipClass(method?.key === m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {method && (
            <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-500/5 p-4">
              {!notified ? (
                <>
                  <p className="text-sm font-semibold text-ink">{method.label} arrive bientôt 🚧</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft/70">
                    Ce moyen de paiement n'est pas encore activé. Laissez votre email pour être averti·e dès qu'il
                    sera disponible — votre montant ({formatFcfa(effectiveAmount)}) est déjà noté.
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink/12 bg-white px-3 py-2 dark:bg-surface-tint">
                    <Mail size={15} className="shrink-0 text-ink-soft/50" />
                    <input
                      type="email"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-sm text-ink outline-none placeholder-ink-soft/50"
                    />
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNotifyMe}
                    disabled={isNotifying}
                    className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-md shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isNotifying ? 'Enregistrement…' : 'Me prévenir'}
                  </motion.button>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-ink">Merci ❤️</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft/70">
                    Nous vous préviendrons dès que {method.label} sera disponible. Votre intérêt compte déjà
                    beaucoup pour nous — grâce à des personnes comme vous, nous pouvons continuer à construire une
                    plateforme africaine de rencontre plus moderne, plus sécurisée et plus proche de sa communauté.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel mt-4 rounded-2xl p-5">
          <p className="text-sm font-semibold text-ink">🤝 Badge Contributeur BomaVibes</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft/70">
            Bientôt, les personnes qui soutiennent BomaVibes recevront un badge symbolique sur leur profil, en
            signe de reconnaissance. Ce badge ne donne aucun avantage dans l'application : il n'influence ni votre
            visibilité, ni les recommandations, ni les matchs, ni l'algorithme. Il sert uniquement à remercier.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Support
