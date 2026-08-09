import { Newspaper } from 'lucide-react'

function FeedEmptyState({ onCreate }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 p-6 text-center">
      <Newspaper size={40} strokeWidth={1.5} className="text-ink-soft/40" />
      <h1 className="font-display text-2xl font-semibold text-ink">Le Feed est encore calme 👀</h1>
      <p className="max-w-xs text-sm text-ink-soft/70">Soyez parmi les premiers à partager quelque chose.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25"
      >
        Créer une publication
      </button>
    </div>
  )
}

export default FeedEmptyState
