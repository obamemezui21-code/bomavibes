import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SiteHeader from '../components/SiteHeader.jsx'

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/bomavibes' },
  { label: 'Facebook', href: 'https://facebook.com/bomavibes' },
  { label: 'TikTok', href: 'https://tiktok.com/@bomavibes' },
  { label: 'WhatsApp', href: 'https://wa.me/33744233809' },
]

function Events() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 text-center sm:px-8 sm:pt-40">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block rounded-full bg-[#1F3D2B]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#1F3D2B]"
        >
          Bientôt disponible
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl"
        >
          Des rencontres, en vrai.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#6b5d4f]"
        >
          On prépare des afterworks et des rencontres organisées pour la communauté BomaVibes,
          pour prolonger les connexions au-delà de l'écran. Rejoins l'app dès maintenant et on
          te préviendra dès que la première date est fixée.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/signup"
            className="rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:bg-[#dba838]"
          >
            Rejoindre BomaVibes
          </Link>
          <a
            href="/#top"
            className="rounded-xl border border-[#1F3D2B]/20 px-7 py-3 text-sm font-semibold text-[#1F3D2B] transition hover:bg-[#1F3D2B]/5"
          >
            Retour à l'accueil
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-14 border-t border-[#1F3D2B]/10 pt-8"
        >
          <p className="text-sm text-[#6b5d4f]">Suis-nous pour ne rien manquer de l'annonce :</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#1F3D2B] underline-offset-4 transition hover:underline"
              >
                {s.label}
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Events
