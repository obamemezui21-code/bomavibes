import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HeartHandshake } from 'lucide-react'

function SupportTeaserSection() {
  return (
    <section id="soutenir" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-24 sm:px-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="rounded-[2.5rem] border border-pink-500/25 bg-gradient-to-br from-white to-pink-500/5 p-10 text-center shadow-sm sm:p-14"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-coral-600 text-white shadow-md">
          <HeartHandshake size={26} strokeWidth={1.75} />
        </span>
        <h2 className="mt-5 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Construisons BomaVibes ensemble
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#6b5d4f]">
          BomaVibes est développé avec la volonté de créer une plateforme de rencontre moderne, sécurisée et
          adaptée aux réalités africaines. Si vous appréciez votre expérience, vous pouvez contribuer librement à
          son évolution.
        </p>
        <Link
          to="/soutenir"
          className="mt-7 inline-block rounded-xl bg-pink-500 px-8 py-3.5 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:-translate-y-0.5 hover:bg-pink-400"
        >
          Soutenir BomaVibes
        </Link>
      </motion.div>
    </section>
  )
}

export default SupportTeaserSection
