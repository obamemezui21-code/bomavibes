import { motion, useReducedMotion } from 'framer-motion'

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-lg shadow-violet-500/25 hover:shadow-violet-500/35 disabled:cursor-not-allowed disabled:opacity-60',
  secondary:
    'border border-ink/12 text-ink/80 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60',
  danger:
    'bg-coral-500 text-white hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60',
}

function Button({ variant = 'primary', type = 'button', className = '', children, ...props }) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.button
      type={type}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      className={`rounded-xl py-2.5 text-sm font-semibold transition ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export default Button
