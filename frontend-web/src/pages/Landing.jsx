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

function Logo({ className }) {
  return (
    <img
      src={logo}
      alt="BomaVibes"
      className={`rounded-full border-2 border-[#C9962B] object-cover object-top shadow-md ${className}`}
    />
  )
}

function Header({ menuOpen, onToggleMenu }) {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo className="h-10 w-10" />
          <span className="font-display text-lg font-bold text-white drop-shadow-sm">
            Boma<span className="text-[#E8C468]">Vibes</span>
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 sm:flex">
          <Link to="/login" className="text-sm font-semibold text-white/90 transition hover:text-white">
            Se connecter
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1F3D2B] shadow-lg transition hover:bg-white/90"
          >
            S'inscrire
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          onClick={onToggleMenu}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl text-[#1F3D2B] shadow-lg backdrop-blur-sm sm:hidden"
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
            className="absolute right-4 top-[4.25rem] w-40 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:hidden"
          >
            <Link to="/login" className="block px-5 py-5 text-sm font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5">
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
    </header>
  )
}

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />

      {/* Social rail (desktop only) */}
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

      {/* Hero */}
      <div className="relative flex min-h-svh items-end overflow-hidden sm:items-center">
        <motion.img
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9 }}
          src={heroPhoto}
          alt="Couple BomaVibes"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/40 sm:to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-32 sm:px-8 sm:py-24">
          <div className="max-w-lg">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl"
            >
              L'amour a sa vibe.
              <br />
              <span className="text-[#E8C468]">Et la tienne ?</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-md text-base leading-relaxed text-white/85"
            >
              BomaVibes est le site de rencontre africain, de la communauté noire, qui
              connecte des célibataires authentiques pour des relations vraies et durables.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/signup"
                className="rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-black/20 transition hover:bg-[#dba838]"
              >
                S'inscrire gratuitement
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/40 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Se connecter
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg backdrop-blur-sm">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="text-xs text-white/70">{f.text}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
