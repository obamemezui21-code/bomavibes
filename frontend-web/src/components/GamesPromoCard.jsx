import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Gamepad2, Play } from 'lucide-react'
import { GAMES } from '../lib/games.js'
import NgoriCoin from './NgoriCoin.jsx'

// Découvrir: the games room, with NGORI RUN up front.
function GamesPromoCard() {
  const navigate = useNavigate()
  const run = GAMES.find((game) => game.id === 'ngori-run')
  const totalCap = GAMES.reduce((sum, game) => sum + game.dailyCap, 0)

  return (
    <section aria-labelledby="games-promo-title" className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${run.gradient} p-5 text-white shadow-lg shadow-violet-900/20`}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/75">
          <Gamepad2 size={14} strokeWidth={2.5} />
          Salon de jeux
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="games-promo-title" className="font-display text-3xl font-black italic leading-none tracking-tight">
              NGORI <span className="text-gold">RUN</span>
            </h2>
            <p className="mt-2 text-sm text-white/85">{run.description}</p>
          </div>
          <div className="flex shrink-0">
            {run.pictures.map((src, i) => (
              <img key={src} src={src} alt="" className={`h-14 w-14 rounded-full object-cover ring-2 ring-white/50 ${i ? '-ml-4' : ''}`} />
            ))}
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(run.path)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-display text-sm font-black tracking-wide text-violet-950 shadow-md"
        >
          <Play size={16} fill="currentColor" />
          JOUER À NGORI RUN
        </motion.button>
        <button type="button" onClick={() => navigate('/jeux')} className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-white/85 hover:text-white">
          {GAMES.length} jeux au salon · jusqu’à {totalCap} <NgoriCoin size={13} /> par jour · Tout voir →
        </button>
      </div>
    </section>
  )
}

export default GamesPromoCard
