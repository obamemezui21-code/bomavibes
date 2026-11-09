import { useNavigate } from 'react-router-dom'
import { ChevronRight, HeartHandshake, Search, Type } from 'lucide-react'

const DAILY = [
  {
    id: 'crush-time',
    path: '/crush-time',
    icon: Search,
    name: 'CrushTime',
    text: '4 profils, l’un d’eux t’a liké·e : devine lequel',
    reward: 'Un match si tu trouves',
    gradient: 'from-[#5b1f6e] via-[#b0306f] to-[#e9467d]',
  },
  {
    id: 'vibe-check',
    path: '/vibe-check',
    icon: HeartHandshake,
    name: 'Vibe Check',
    text: '8 questions, et découvre qui a la même vibe que toi',
    reward: 'Jusqu’à 3 Ngori',
    gradient: 'from-[#2a0f45] via-[#4b2a8a] to-[#7c5cf0]',
  },
  {
    id: 'mot-du-jour',
    path: '/mot-du-jour',
    icon: Type,
    name: 'Le Mot du Jour',
    text: 'Un mot à trouver, le même pour tout le monde',
    reward: 'Jusqu’à 3 Ngori',
    gradient: 'from-[#0f3b2e] via-[#17694f] to-[#2bb37f]',
  },
]

// Découvrir: the three daily challenges, a reason to come back every day.
// Phone: stacked. Computer: side by side, under a centred title.
function DiscoverDailyRow() {
  const navigate = useNavigate()
  return (
    <section aria-labelledby="discover-daily-title" className="w-full">
      <div className="px-1 desktop:text-center">
        <h2 id="discover-daily-title" className="font-display text-base font-semibold text-ink">
          ☀️ Tes défis du jour
        </h2>
        <p className="text-xs text-ink-soft/60">Nouveau chaque jour, à faire en 1 minute</p>
      </div>
      <div className="mt-3 grid gap-3 desktop:grid-cols-3">
        {DAILY.map(({ id, path, icon: Icon, name, text, reward, gradient }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(path)}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-left text-white shadow-lg shadow-violet-900/15 transition hover:-translate-y-0.5`}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Icon size={22} strokeWidth={2.25} />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block font-display text-base font-black tracking-tight">{name}</span>
              <span className="block text-xs leading-snug text-white/80">{text}</span>
              <span className="mt-1 block text-[11px] font-bold text-amber-200">{reward}</span>
            </span>
            <ChevronRight size={20} className="relative shrink-0 text-white/70 transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </section>
  )
}

export default DiscoverDailyRow
