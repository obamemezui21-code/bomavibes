import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { GAMES } from '../lib/games.js'
import poster from '../assets/game/poster-ngori-run.webp'
import NgoriCoin from './NgoriCoin.jsx'

// Découvrir: the NGORI RUN poster, full body heroes over Libreville at dusk.
// The title sits in the sky and the rest under the picture, which fades into
// it: nothing covers the characters.
function GamesPromoCard() {
  const navigate = useNavigate()
  const run = GAMES.find((game) => game.id === 'ngori-run')

  return (
    <section aria-labelledby="games-promo-title" className="relative overflow-hidden rounded-[28px] bg-[#170a2b] shadow-2xl shadow-violet-900/40">
      <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={() => navigate(run.path)} aria-label="Jouer à NGORI RUN" className="block w-full text-center">
        <span className="relative block aspect-[4/5] w-full">
          <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[#170a2b]/85 via-[#170a2b]/35 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 h-1/6 bg-gradient-to-t from-[#170a2b] to-transparent" />
          <span className="absolute inset-x-0 top-0 block px-5 pt-5">
            <span className="block text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200">Salon de jeux</span>
            <span id="games-promo-title" className="mt-0.5 block font-display text-[clamp(2.75rem,14vw,4.5rem)] font-black italic leading-none tracking-tight text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.65)]">
              NGORI <span className="text-gold">RUN</span>
            </span>
          </span>
        </span>

        <span className="block px-5 pt-1">
          <span className="block font-display text-lg font-bold leading-snug text-white">Cours, saute, esquive les taxis de Libreville</span>
          <span className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-amber-200">
            Gagne jusqu’à {run.dailyCap} <NgoriCoin size={15} /> par jour
          </span>
          <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 py-3.5 font-display text-base font-black tracking-wide text-white shadow-lg shadow-black/40">
            <Play size={18} fill="currentColor" />
            JOUER MAINTENANT
          </span>
        </span>
      </motion.button>

      <button type="button" onClick={() => navigate('/jeux')} className="block w-full py-3.5 text-center text-sm font-semibold text-white/85 transition hover:text-white">
        Voir les {GAMES.length} jeux du salon →
      </button>
    </section>
  )
}

export default GamesPromoCard
