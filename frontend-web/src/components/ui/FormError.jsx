import { AlertCircle } from 'lucide-react'

function FormError({ children }) {
  if (!children) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400">
      <AlertCircle size={15} strokeWidth={2.25} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export default FormError
