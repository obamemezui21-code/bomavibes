import { motion } from 'framer-motion'
import logo from '../assets/bomavibes-logo.jpeg'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-surface md:flex-row">
      {/* Brand panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-pink-500 px-6 py-12 md:w-1/2 md:py-0">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/20 blur-[90px] animate-float-slow" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-pink-300/40 blur-[90px] animate-float-slower" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex flex-col items-center gap-6 text-center"
        >
          <motion.img
            src={logo}
            alt="BomaVibes — la rencontre gabonaise"
            className="w-32 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-4 ring-white/40 md:w-64"
            initial={{ scale: 0.9, rotate: -3 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
          <div className="hidden max-w-xs flex-col gap-3 md:flex">
            <h1 className="font-display text-3xl font-bold text-white">Trouve ta vibe</h1>
            <p className="text-sm leading-relaxed text-white/85">
              La communauté gabonaise pour des rencontres authentiques, vibrantes et sincères.
            </p>
          </div>
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
