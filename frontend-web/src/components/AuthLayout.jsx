import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import logo from '../assets/bomavibes-logo.jpeg'
import brandPhoto from '../assets/loginpic.jpg'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-surface md:flex-row">
      {/* Brand panel */}
      <div className="relative flex items-center justify-center overflow-hidden px-6 py-12 md:w-1/2 md:py-0">
        <img
          src={brandPhoto}
          alt="Membres de la communauté BomaVibes"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-violet-950/95 via-violet-950/60 to-violet-950/30" />

        <img
          src={logo}
          alt="BomaVibes"
          className="absolute left-6 top-6 h-12 w-12 rounded-full border-2 border-pink-500 object-cover object-top shadow-md md:left-8 md:top-8"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex flex-col items-center gap-3 text-center"
        >
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Trouvez votre <span className="text-pink-400">vibe</span>
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-white/85">
            La communauté gabonaise pour des rencontres authentiques, vibrantes et sincères.
          </p>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center bg-surface-soft px-4 py-10 md:w-1/2">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-300/25 blur-[90px]" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-pink-300/25 blur-[90px]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="glass-panel-solid relative z-10 w-full max-w-sm rounded-3xl p-6 sm:p-8"
        >
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Retour à l'accueil
          </Link>

          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
        </motion.div>
      </div>
    </div>
  )
}

export default AuthLayout
