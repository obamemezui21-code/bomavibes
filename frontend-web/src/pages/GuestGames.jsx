import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Play, RotateCcw, Sparkles, X } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import { GAMES } from '../lib/games.js'
import { practiceSeed } from '../game/practice.js'
import CommandoScreen from '../game/commando/CommandoScreen.jsx'
import { createCommandoAudio, loadMuted as loadCommandoMuted, saveMuted as saveCommandoMuted } from '../game/commando/audio.js'
import MotoScreen from '../game/motoBoma/MotoScreen.jsx'
import GameScreen from '../game/ngoriRun/GameScreen.jsx'
import { createGameAudio, loadMuted, saveMuted } from '../game/ngoriRun/audio.js'
import { formatTicks, MEDAL_EMOJI, MEDAL_LABEL } from '../game/motoBoma/format.js'
import { simulateGame } from '../../../shared/commando-okoume/engine.mjs'
import { DEFAULT_COURSE, simulateRace } from '../../../shared/moto-boma/engine.mjs'
import { simulateRun } from '../../../shared/ngori-run/engine.mjs'

// "Salon de jeux": the games anyone can play from a link, without an
// account (bomavibes.tech/jouer). Guests play in practice mode — the run never
// reaches the server: no Ngori, no ranking — and are invited to sign up at
// the end. Commando Okoumé: mission 1 only.
const GUEST_GAMES = ['commando-okoume', 'moto-boma', 'ngori-run']
const COMMANDO_OPTIONS = { character: 'mboumba', maxHp: 4 }
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

// What an account adds, per game, for the end-of-game invitation.
const WITH_ACCOUNT = {
  'commando-okoume': 'débloquer les missions 2 et 3, monter en grade jusqu’à Colonel, jouer l’Adjudante Moussavou et gagner des Ngori',
  'moto-boma': 'gagner des Ngori, entrer au classement et défier tes matchs en duel',
  'ngori-run': 'gagner des Ngori à chaque course et entrer au classement',
}

function resultLines(gameId, play, payload) {
  if (gameId === 'commando-okoume') {
    const r = simulateGame(play.seed, 1, COMMANDO_OPTIONS, payload.inputs, payload.endTick)
    return {
      title: r.completed ? 'Mission accomplie !' : 'Mission échouée',
      lines: [`Score : ${r.score}`, `${r.kills} braconnier${r.kills > 1 ? 's' : ''} hors de combat`, `Otages libérés : ${r.hostagesFreed}/${r.hostagesTotal}`],
      stars: r.stars,
    }
  }
  if (gameId === 'moto-boma') {
    const r = simulateRace(play.seed, DEFAULT_COURSE, payload.inputs, payload.endTick)
    return {
      title: r.finished ? `Arrivée en ${formatTicks(r.finishTick)}` : 'Course interrompue',
      lines: [r.medal ? `${MEDAL_EMOJI[r.medal]} Médaille ${MEDAL_LABEL[r.medal]}` : 'Pas de médaille cette fois', `${r.coins} pièce${r.coins > 1 ? 's' : ''} ramassée${r.coins > 1 ? 's' : ''}`],
    }
  }
  const r = simulateRun(play.seed, payload.inputs, payload.endTick)
  return {
    title: 'Course terminée',
    lines: [`Score : ${r.score}`, `Distance : ${r.distance} m`, `${r.coins} pièce${r.coins > 1 ? 's' : ''} ramassée${r.coins > 1 ? 's' : ''}`],
  }
}

function GuestGames() {
  const games = GUEST_GAMES.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean)
  const locked = GAMES.filter((g) => !GUEST_GAMES.includes(g.id))
  const [play, setPlay] = useState(null) // { gameId, seed, key }
  const [result, setResult] = useState(null)
  const [commandoAudio] = useState(() => createCommandoAudio(loadCommandoMuted()))
  const [runAudio] = useState(() => createGameAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const playCount = useRef(0) // a fresh game screen for every game

  function start(gameId) {
    if (gameId === 'commando-okoume') commandoAudio.unlock()
    else runAudio.unlock()
    setResult(null)
    playCount.current += 1
    setPlay({ gameId, seed: practiceSeed(), key: playCount.current })
  }

  function end(payload) {
    if (!play) return
    if (payload.endTick < 1) {
      setPlay(null)
      return
    }
    setResult({ gameId: play.gameId, ...resultLines(play.gameId, play, payload) })
    setPlay(null)
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    saveCommandoMuted(next)
    runAudio.setMuted?.(next)
    commandoAudio.setMuted(next)
  }

  return (
    <div className="min-h-svh bg-surface-soft">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-28 sm:pt-32">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-600">BomaVibes</p>
          <h1 className="mt-1 font-display text-3xl font-black text-ink">Le salon de jeux</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Joue tout de suite, sans créer de compte. Les jeux 100 % gabonais de BomaVibes, sur ton téléphone ou ton ordinateur.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {games.map((game) => (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => start(game.id)}
              whileTap={{ scale: 0.98 }}
              className={`relative block w-full overflow-hidden rounded-[28px] bg-gradient-to-br ${game.gradient} p-5 text-left text-white shadow-xl shadow-violet-900/20`}
            >
              {game.cover && (
                <>
                  <img src={game.cover} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" />
                </>
              )}
              <div className="relative flex items-end gap-4">
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] ${game.accent}`}>{game.tagline}</p>
                  <h2 className="mt-1 font-display text-3xl font-black italic tracking-tight">{game.name}</h2>
                  <p className="mt-2 text-sm text-white/80">{game.description}</p>
                  {game.id === 'commando-okoume' && <p className="mt-2 text-xs text-white/70">Mission 1 en accès libre.</p>}
                </div>
                {!game.cover && (
                  <div className="flex shrink-0 items-end">
                    {game.pictures.map((src, k) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className={`drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] ${game.round ? 'h-16 w-16 rounded-full object-cover ring-2 ring-white/50' : 'h-28 w-auto object-contain'} ${
                          k ? (game.round ? '-ml-4' : '-ml-5') : ''
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <span className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-display text-sm font-black tracking-wide text-violet-950">
                <Play size={16} fill="currentColor" /> JOUER
              </span>
            </motion.button>
          ))}
        </div>

        {locked.length > 0 && (
          <div className="mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-ink/8 dark:bg-surface-tint">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Lock size={14} /> Avec un compte gratuit
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {locked.map((g) => (
                <li key={g.id}>
                  <b className="text-ink">{g.name}</b> — {g.tagline}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-[24px] bg-gradient-to-r from-violet-600 to-pink-500 p-5 text-center text-white">
          <p className="font-display text-lg font-bold">Envie d’aller plus loin ?</p>
          <p className="mt-1 text-sm text-white/85">
            Avec ton compte BomaVibes, tes parties rapportent des Ngori, tu entres au classement… et tu fais des rencontres.
          </p>
          <Link to="/signup" className="mt-3 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-violet-700">
            Créer mon compte gratuit
          </Link>
        </div>
      </main>

      {/* The game itself, full screen */}
      {play?.gameId === 'commando-okoume' && (
        <CommandoScreen
          key={play.key}
          seed={play.seed}
          mission={1}
          options={COMMANDO_OPTIONS}
          audio={commandoAudio}
          muted={muted}
          onToggleMute={toggleMute}
          onEnd={end}
        />
      )}
      {play?.gameId === 'moto-boma' && (
        <div className="fixed inset-0 z-[95] bg-black">
          <MotoScreen key={play.key} seed={play.seed} course={DEFAULT_COURSE} runner="man" audio={runAudio} muted={muted} onToggleMute={toggleMute} onEnd={end} />
        </div>
      )}
      {play?.gameId === 'ngori-run' && (
        <div className="fixed inset-0 z-[95] bg-black">
          <GameScreen key={play.key} seed={play.seed} runner="man" billboards={[]} audio={runAudio} muted={muted} onToggleMute={toggleMute} showButtons={TOUCH} onEnd={end} />
        </div>
      )}

      {/* End of a guest game: the score, and what an account adds */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="relative w-full max-w-sm rounded-3xl bg-surface p-5 text-center">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
              <p className="font-display text-2xl font-bold text-ink">{result.title}</p>
              {result.stars > 0 && <p className="mt-1 text-2xl">{'⭐'.repeat(result.stars)}</p>}
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {result.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl bg-violet-500/10 p-3 text-sm text-ink">
                <p className="flex items-center justify-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300">
                  <Sparkles size={14} /> Avec un compte gratuit
                </p>
                <p className="mt-1 text-ink-soft">Tu pourrais {WITH_ACCOUNT[result.gameId]}.</p>
              </div>
              <Link to="/signup" className="mt-4 block rounded-full bg-gradient-to-r from-violet-600 to-pink-500 py-3 text-sm font-bold text-white">
                Créer mon compte gratuit
              </Link>
              <button
                type="button"
                onClick={() => start(result.gameId)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold text-ink-soft hover:bg-ink/5"
              >
                <RotateCcw size={14} /> Rejouer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GuestGames
