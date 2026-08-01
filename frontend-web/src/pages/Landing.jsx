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

const NAV_LINKS = [
  { label: 'Accueil', href: '#top' },
  { label: 'À propos', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/bomavibes' },
  { label: 'Facebook', href: 'https://facebook.com/bomavibes' },
  { label: 'TikTok', href: 'https://tiktok.com/@bomavibes' },
  { label: 'WhatsApp', href: 'https://wa.me/24100000000' },
]

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      )}
    </svg>
  )
}

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
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-semibold text-white/90 transition hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          onClick={onToggleMenu}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1F3D2B] shadow-lg backdrop-blur-sm sm:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <MenuIcon open={menuOpen} />
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
            className="absolute right-4 top-[4.25rem] w-48 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:hidden"
          >
            {NAV_LINKS.map((l, i) => (
              <a
                key={l.label}
                href={l.href}
                className={`block px-5 py-4 text-sm font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5 ${
                  i > 0 ? 'border-t border-black/5' : ''
                }`}
              >
                {l.label}
              </a>
            ))}
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

      {/* Hero */}
      <div id="top" className="relative flex min-h-svh items-end overflow-hidden sm:items-center">
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

      {/* About */}
      <section id="about" className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold text-[#2B1D14]">À propos de BomaVibes</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#6b5d4f]">
          BomaVibes est né d'une conviction simple : les célibataires africains et de la
          communauté noire méritent un espace de rencontre pensé pour eux, qui célèbre leur
          culture et leurs valeurs. Notre mission est de créer des connexions authentiques,
          sûres et durables, portées par une communauté vérifiée et bienveillante.
        </p>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-[#1F3D2B] px-4 py-20 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold text-white">Contactez-nous</h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/75">
          Une question, une suggestion ? Écris-nous, on te répond avec plaisir.
        </p>
        <a
          href="mailto:contact@bomavibes.tech"
          className="mt-6 inline-block rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:bg-[#dba838]"
        >
          contact@bomavibes.tech
        </a>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Landing
