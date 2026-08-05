import { motion } from 'framer-motion'
import { Bell, Globe2, Heart, Mic, ShieldOff, Sparkles } from 'lucide-react'

const FEATURES = [
  {
    icon: Heart,
    title: 'Découverte & matchs',
    text: "Parcourez des profils authentiques, filtrez par âge, genre et distance, et matchez quand l'intérêt est mutuel.",
  },
  {
    icon: Mic,
    title: 'Messagerie & notes vocales',
    text: 'Discutez en texte ou en messages vocaux, avec indicateur de frappe et modification/suppression à tout moment.',
  },
  {
    icon: Sparkles,
    title: 'Qui vous a liké·e',
    text: "Découvrez qui s'intéresse déjà à vous avant même de matcher, dans un écran dédié.",
  },
  {
    icon: ShieldOff,
    title: 'Signalement & blocage',
    text: 'Un profil vous met mal à l\'aise ? Signalez-le ou bloquez-le en un geste, avec effet immédiat des deux côtés.',
  },
  {
    icon: Globe2,
    title: 'Profils enrichis',
    text: "Pays, région, ville, langues parlées, personnalité et objectifs de rencontre : un profil qui vous ressemble vraiment.",
  },
  {
    icon: Bell,
    title: 'Notifications en temps réel',
    text: 'Soyez averti·e instantanément à chaque match, message ou nouveauté de la plateforme.',
  },
]

function FeaturesGridSection() {
  return (
    <section id="fonctionnalites" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Nos fonctionnalités</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
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
            className="rounded-3xl border border-[#1F3D2B]/8 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#C9962B]/20 to-[#1F3D2B]/10">
              <f.icon size={22} strokeWidth={1.75} className="text-[#1F3D2B]" />
            </div>
            <h3 className="mt-5 font-display text-lg font-bold text-[#2B1D14]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b5d4f]">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default FeaturesGridSection
