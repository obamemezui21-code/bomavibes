import { motion } from 'framer-motion'
import { BadgeCheck, Crown, Heart, Mic, Palette, Rocket, ShieldOff, Sparkles, Video } from 'lucide-react'

// `isNew` marks what shipped recently — drop it once it's no longer news.
const FEATURES = [
  {
    icon: Heart,
    title: 'Découverte & matchs',
    text: "Parcourez des profils authentiques, filtrez par âge, genre et distance, et matchez quand l'intérêt est mutuel.",
  },
  {
    icon: Mic,
    title: 'Messagerie & notes vocales',
    text: 'Discutez en texte ou en messages vocaux, avec indicateur de frappe, réactions et modification à tout moment.',
  },
  {
    icon: Video,
    title: 'Appels audio & vidéo',
    text: "Appelez vos matchs directement dans l'app et retrouvez l'historique de vos appels : un appui suffit pour rappeler.",
    isNew: true,
  },
  {
    icon: BadgeCheck,
    title: 'Profil vérifié',
    text: 'Un selfie avec la pose demandée, vérifié par notre équipe : le badge ✓ montre à vos matchs que vous êtes bien vous.',
    isNew: true,
  },
  {
    icon: Palette,
    title: 'Publications en couleur',
    text: 'Partagez vos pensées dans le fil avec un fond coloré et une police à votre style.',
    isNew: true,
  },
  {
    icon: Sparkles,
    title: 'Qui vous a liké·e',
    text: "Découvrez qui s'intéresse déjà à vous avant même de matcher, dans un écran dédié.",
  },
  {
    icon: Crown,
    title: 'Forfaits Premium',
    text: 'VIP, Diamant Rouge ou Jadéite Impériale : likes illimités, Super Likes et plus de visibilité. Paiement Airtel Money ou Moov Money.',
    isNew: true,
  },
  {
    icon: Rocket,
    title: 'Boost & mode invisible',
    text: "Passez en tête de Découvrir pendant 30 minutes, ou naviguez sans être vu·e avec l'offre Jadéite Impériale.",
    isNew: true,
  },
  {
    icon: ShieldOff,
    title: 'Signalement & blocage',
    text: 'Un profil vous met mal à l\'aise ? Signalez-le ou bloquez-le en un geste, avec effet immédiat des deux côtés.',
  },
]

function FeaturesGridSection() {
  return (
    <section id="fonctionnalites" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#261b28] sm:text-5xl">Nos fonctionnalités</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#635a65]">
          Tout ce qu'il faut pour faire de vraies rencontres, sans fioritures inutiles.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: i * 0.05, ease: 'easeOut' }}
            className="rounded-3xl border border-violet-600/8 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-violet-600/10">
                <f.icon size={22} strokeWidth={1.75} className="text-violet-600" />
              </div>
              {f.isNew && (
                <span className="rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Nouveau
                </span>
              )}
            </div>
            <h3 className="mt-5 font-display text-lg font-bold text-[#261b28]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#635a65]">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default FeaturesGridSection
