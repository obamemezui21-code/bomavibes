import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Database, KeyRound, Lock, ShieldOff, Trash2, UserCheck } from 'lucide-react'

const PILLARS = [
  {
    icon: ShieldOff,
    title: 'Signalement & blocage réels',
    text: "Un signalement est examiné par notre équipe. Un blocage empêche vraiment l'autre personne de vous contacter — pas seulement à l'écran, mais aussi côté serveur.",
  },
  {
    icon: KeyRound,
    title: 'Mots de passe jamais en clair',
    text: "L'authentification est gérée par Firebase : votre mot de passe n'est jamais stocké ni visible, même par nous.",
  },
  {
    icon: Lock,
    title: 'Connexions chiffrées',
    text: 'Toutes les communications entre votre appareil et nos serveurs passent en HTTPS chiffré.',
  },
  {
    icon: Database,
    title: 'Vos données, votre contrôle',
    text: "Vos données ne sont jamais vendues. Consultez, modifiez ou supprimez votre compte à tout moment depuis les Paramètres.",
  },
  {
    icon: Trash2,
    title: 'Suppression définitive',
    text: "Supprimer votre compte efface réellement vos données, sans délai caché ni conservation fantôme.",
  },
  {
    icon: UserCheck,
    title: 'Photo de profil obligatoire',
    text: "Chaque profil doit inclure une photo réelle pour être visible dans Découvrir, contre les faux comptes.",
  },
]

function SecuritySection() {
  return (
    <section id="securite" className="scroll-mt-20 bg-violet-600 px-4 py-24 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">Votre sécurité est notre priorité</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
            Une plateforme de rencontre digne de confiance se construit avec des garde-fous réels, pas juste des
            promesses.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: 'easeOut' }}
              className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/15">
                <p.icon size={22} strokeWidth={1.75} className="text-pink-400" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{p.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/securite"
            className="inline-block rounded-xl bg-pink-500 px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:bg-pink-400"
          >
            En savoir plus sur la sécurité
          </Link>
        </div>
      </div>
    </section>
  )
}

export default SecuritySection
