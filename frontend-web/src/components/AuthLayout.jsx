import { motion } from 'framer-motion'
import logo from '../assets/bomavibes-logo.jpeg'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-ink md:flex-row">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-forest-500/30 blur-[100px] animate-float-slow" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-gold-500/20 blur-[100px] animate-float-slower" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-coral-500/10 blur-[110px] animate-float-slow" />

      {/* Brand panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-forest-950 via-forest-900 to-ink px-6 py-12 md:w-1/2 md:py-0">
        <div className="noise-overlay" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex flex-col items-center gap-6 text-center"
        >
          <motion.img
            src={logo}
            alt="BomaVibes — la rencontre gabonaise"
            className="w-32 rounded-3xl shadow-[0_20px_60px_-15px_rgba(201,150,43,0.5)] ring-1 ring-white/10 md:w-64"
            initial={{ scale: 0.9, rotate: -3 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
          <div className="hidden max-w-xs flex-col gap-3 md:flex">
            <h1 className="font-display text-3xl font-semibold text-cream-100">
              Trouve ta <span className="text-gradient-gold italic">vibe</span>
            </h1>
            <p className="text-sm leading-relaxed text-cream-300/80">
              La communauté gabonaise pour des rencontres authentiques, vibrantes et sincères.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10 md:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="glass-panel relative z-10 w-full max-w-sm rounded-3xl p-6 shadow-2xl sm:p-8"
        >
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-cream-100">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm text-cream-300/70">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-cream-300/70">{footer}</div>}
        </motion.div>
      </div>
    </div>
  )
}

export default AuthLayout
