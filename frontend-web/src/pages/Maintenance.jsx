import { Wrench } from 'lucide-react'

function Maintenance() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-soft px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25">
        <Wrench size={26} strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl font-semibold text-ink">BomaVibes est en maintenance</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft/70">
        Nous améliorons l'application. Merci de revenir un peu plus tard.
      </p>
    </div>
  )
}

export default Maintenance
