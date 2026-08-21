import { motion, useReducedMotion } from 'framer-motion'
import { panelPop } from '../../lib/motion.js'

function Modal({ onClose, children, className = '' }) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={panelPop.initial}
        animate={panelPop.animate}
        exit={panelPop.exit}
        transition={prefersReducedMotion ? { duration: 0 } : panelPop.transition}
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel w-full max-w-sm rounded-2xl p-6 ${className}`}
      >
        {children}
      </motion.div>
    </div>
  )
}

export default Modal
