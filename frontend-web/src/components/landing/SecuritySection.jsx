import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, CreditCard, EyeOff, Flag, Lock, ShieldCheck } from 'lucide-react'

const EASE = [0.22, 1, 0.36, 1]

// Every claim here matches something the app actually does — keep it that
// way when editing (see the security report in docs/).
const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Comptes protégés',
    text: 'Vérification anti-robot à l’inscription, mots de passe jamais stockés en clair et limites contre les tentatives abusives.',
  },
  {
    icon: BadgeCheck,
    title: 'Profils vérifiés',
    text: 'Le badge ✓ est attribué après vérification d’un selfie par notre équipe, pour limiter les faux comptes.',
  },
  {
    icon: Flag,
    title: 'Signalement & blocage',
    text: 'Signalez ou bloquez en un geste. Le blocage est appliqué par nos serveurs : la personne ne peut plus vous contacter.',
  },
  {
    icon: EyeOff,
    title: 'Confidentialité',
    text: 'Vos données ne sont jamais vendues. Consultez-les, modifiez-les ou supprimez votre compte définitivement à tout moment.',
  },
  {
    icon: Lock,
    title: 'Échanges sécurisés',
    text: 'Toutes les communications entre votre appareil et nos serveurs sont chiffrées (HTTPS).',
  },
  {
    icon: CreditCard,
    title: 'Paiements sécurisés',
    text: 'Airtel Money et Moov Money via notre partenaire SingPay. Chaque paiement est confirmé par nos serveurs, et nous ne vous demanderons jamais votre code secret.',
  },
]

function SecuritySection() {
  return (
    <section id="securite" className="relative isolate scroll-mt-20 overflow-hidden bg-[#4b164c] px-4 py-24 text-white sm:px-8 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-pink-500/25 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-400/20 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">Confiance & sécurité</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">Rencontrez l'esprit tranquille</h2>
          <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
            Une plateforme de rencontre digne de confiance se construit avec des protections réelles, pas des promesses.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: EASE }}
              className="group rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur transition duration-500 hover:-translate-y-1 hover:bg-white/10 hover:ring-white/20"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400/30 to-violet-400/20 text-pink-200 ring-1 ring-white/15 transition duration-500 group-hover:scale-105">
                <p.icon size={22} />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{p.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/securite"
            className="group inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.98]"
          >
            Nos conseils de sécurité
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default SecuritySection
