import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import logo from '../assets/bomavibes-logo.jpeg'
import heroPhoto from '../assets/hero.png'

const FEATURES = [
  { icon: '🛡️', title: 'Sécurisé', text: 'Vos données sont protégées' },
  { icon: '💚', title: 'Authentique', text: 'Des profils vérifiés et réels' },
  { icon: '👥', title: 'Afrocentré', text: 'Une communauté qui te ressemble' },
]

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/bomavibes', icon: '📷' },
  { label: 'Facebook', href: 'https://facebook.com/bomavibes', icon: '📘' },
  { label: 'TikTok', href: 'https://tiktok.com/@bomavibes', icon: '🎵' },
  { label: 'WhatsApp', href: 'https://wa.me/24100000000', icon: '💬' },
]

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#FAF6EF]">
      {/* Mobile/tablet hero banner */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96 lg:hidden">
        <img
          src={heroPhoto}
          alt="Couple BomaVibes"
          className="h-full w-full object-cover object-[92%_38%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-[#FAF6EF]" />

        {/* Mobile top nav */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
          <img
            src={logo}
            alt="BomaVibes"
            className="h-12 w-12 rounded-full border-2 border-[#C9962B] object-cover object-top shadow-lg"
          />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow-lg backdrop-blur-sm"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: 'top' }}
              className="absolute right-4 top-[4.25rem] z-20 w-40 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              <Link
                to="/login"
                className="block px-5 py-5 text-sm font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5"
              >
                Se connecter
              </Link>
              <Link
                to="/signup"
                className="block border-t border-black/5 px-5 py-5 text-sm font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5"
              >
                S'inscrire
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Social rail */}
      <div className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        {SOCIALS.map((s, i) => (
          <motion.a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            whileHover={{ scale: 1.1, x: -4 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-lg ring-1 ring-black/5 transition"
            aria-label={s.label}
            title={s.label}
          >
            {s.icon}
          </motion.a>
        ))}
      </div>

      <div className="relative grid min-h-svh lg:grid-cols-2">
        {/* Left: content */}
        <div className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
          <motion.img
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            src={logo}
            alt="BomaVibes"
            className="mb-6 hidden h-24 w-24 rounded-full border-4 border-[#C9962B] object-cover object-top shadow-lg lg:block"
          />

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl font-bold leading-tight text-[#2B1D14] sm:text-5xl"
          >
            L'amour a sa vibe.
            <br />
            <span className="text-[#C9962B]">Et la tienne ?</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 max-w-md text-base leading-relaxed text-[#6b5d4f]"
          >
            BomaVibes est le site de rencontre africain, de la communauté noire, qui
            connecte des célibataires authentiques pour des relations vraies et durables.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              to="/signup"
              className="rounded-xl bg-[#1F3D2B] px-7 py-3 text-sm font-semibold text-[#F5EFE3] shadow-lg shadow-[#1F3D2B]/20 transition hover:bg-[#16301f]"
            >
              S'inscrire gratuitement
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-[#1F3D2B]/20 bg-white px-7 py-3 text-sm font-semibold text-[#1F3D2B] transition hover:bg-[#1F3D2B]/5"
            >
              Se connecter
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3D2B]/10 text-lg">
                  {f.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#2B1D14]">{f.title}</p>
                  <p className="text-xs text-[#6b5d4f]">{f.text}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: hero photo */}
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative hidden lg:block"
        >
          <img src={heroPhoto} alt="Couple BomaVibes" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#FAF6EF] via-transparent to-transparent" />
        </motion.div>
      </div>
    </div>
  )
}

export default Landing
