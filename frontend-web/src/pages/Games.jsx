import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Gamepad2, Play } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { GAMES } from '../lib/games.js'
import NgoriCoin from '../components/NgoriCoin.jsx'

// "Jeux" — every game Kévin and Aïcha take part in, from lib/games.js.
function Games() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const balance = account?.ngori || 0
  const totalCap = GAMES.reduce((sum, g) => sum + g.dailyCap, 0)

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Jeux</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-ink">
          <NgoriCoin size={18} /> {balance}
        </span>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-600">
            <Gamepad2 size={22} />
          </span>
          <p className="text-sm text-ink-soft/80">
            Joue avec Kévin ou Aïcha et gagne jusqu’à <strong className="text-ink">{totalCap} Ngori par jour</strong> en tout.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {GAMES.map((game, i) => (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => navigate(game.path)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              className={`relative block w-full overflow-hidden rounded-[28px] bg-gradient-to-br ${game.gradient} p-5 text-left text-white shadow-xl shadow-violet-900/20`}
            >
              {game.cover ? (
                <>
                  <img src={game.cover} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" />
                </>
              ) : (
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              )}
              <div className="relative flex items-end gap-4">
                <div className="min-w-0 flex-1">
                  {game.isNew && (
                    <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                      Nouveau
                    </span>
                  )}
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] ${game.accent}`}>{game.tagline}</p>
                  <h2 className="mt-1 font-display text-3xl font-black italic tracking-tight">{game.name}</h2>
                  <p className="mt-2 text-sm text-white/80">{game.description}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-white/70">
                    <NgoriCoin size={14} /> Jusqu’à {game.dailyCap} Ngori par jour
                  </p>
                </div>
                <div className={`flex shrink-0 items-end ${game.cover ? 'hidden' : ''}`}>
                  {game.pictures.map((src, k) => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className={`drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] ${
                        game.round ? 'h-16 w-16 rounded-full object-cover ring-2 ring-white/50' : 'h-28 w-auto object-contain'
                      } ${k ? (game.round ? '-ml-4' : '-ml-5') : ''}`}
                    />
                  ))}
                </div>
              </div>
              <span className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-display text-sm font-black tracking-wide text-violet-950">
                <Play size={16} fill="currentColor" /> JOUER
              </span>
            </motion.button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft/60">D’autres jeux arrivent bientôt 🎮</p>
      </div>
    </div>
  )
}

export default Games
