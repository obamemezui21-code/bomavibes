import { useEffect, useState } from 'react'
import { Swords } from 'lucide-react'
import { getMotoChallenge } from '../../firebase/motoBoma.js'
import { COURSES } from '../../../../shared/moto-boma/engine.mjs'
import { formatTicks } from '../../game/motoBoma/format.js'
import motoKevin from '../../assets/game/moto-kevin.webp'
import motoAicha from '../../assets/game/moto-aicha.webp'

// A MOTO BOMA ghost duel in the chat (posted by the server, see
// motoBomaController.js): who challenged, their time, and where the duel
// stands — fetched live, so the card stays current once it's been raced.
function MotoChallengeCard({ challenge, onOpen }) {
  const [state, setState] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMotoChallenge(challenge.id)
      .then((c) => !cancelled && setState(c))
      .catch(() => !cancelled && setState({ failed: true }))
    return () => {
      cancelled = true
    }
  }, [challenge.id])

  const course = COURSES[challenge.course]?.name || 'Moto Boma'
  let status = 'Chargement…'
  let action = null
  if (state?.failed) status = 'Défi indisponible'
  else if (state) {
    if (state.status === 'pending') {
      status = state.mine ? 'En attente de sa course' : 'À toi de jouer : une seule tentative !'
      if (!state.mine) action = 'Relever le défi'
    } else if (state.status === 'expired') status = 'Défi expiré'
    else if (state.status === 'accepted') status = 'Course en cours…'
    else {
      // opponentTicks: the challenged one's time (theirs for the challenger, mine otherwise).
      const time = state.opponentTicks ? formatTicks(state.opponentTicks) : 'abandon'
      const verdict = { me: '🏆 Tu as gagné', them: '😅 Perdu', draw: '🤝 Égalité' }[state.winner] || 'Terminé'
      status = `${verdict} · ${state.mine ? `${state.toName || 'son temps'} : ${time}` : `ton temps : ${time}`}`
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className="flex min-w-0 max-w-full items-stretch gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#12081f] to-[#3b0f5c] p-2.5 text-left text-white shadow-sm"
      style={{ maxWidth: 'clamp(220px, 100%, 260px)' }}
    >
      <img src={challenge.runner === 'woman' ? motoAicha : motoKevin} alt="" className="h-20 w-10 shrink-0 object-contain" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-cyan-300">
          <Swords size={11} strokeWidth={2.5} /> {challenge.result ? 'Résultat du duel' : 'Duel Moto Boma'}
        </span>
        <span className="mt-0.5 block font-display text-sm font-bold leading-snug">
          {challenge.firstName} · {formatTicks(challenge.finishTick)}
        </span>
        <span className="block truncate text-[11px] text-white/60">{course}</span>
        <span className="mt-1 block text-xs font-semibold text-white/85">{status}</span>
        {action && (
          <span className="mt-1.5 inline-block rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-cyan-950">{action}</span>
        )}
      </span>
    </button>
  )
}

export default MotoChallengeCard
