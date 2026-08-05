import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#163d29] to-[#0e2a1e] px-4 py-28 text-center sm:px-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#C9962B]/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#7A0F1E]/15 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mx-auto max-w-2xl"
      >
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Votre prochaine rencontre commence ici
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/75">
          Rejoignez une communauté authentique, sûre et pensée pour vous. C'est gratuit, et ça prend 30 secondes.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-xl bg-[#C9962B] px-8 py-3.5 text-base font-semibold text-[#2B1D14] shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#dba838] hover:shadow-xl active:translate-y-0"
          >
            Créer mon compte gratuitement
          </Link>
          <Link
            to="/welcome"
            className="rounded-xl border border-white/40 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/20 active:translate-y-0"
          >
            Se connecter
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

export default FinalCtaSection
