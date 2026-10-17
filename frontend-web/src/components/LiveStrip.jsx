import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchLivesAvailable, startLive, subscribeToLivesNow } from '../firebase/lives.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

// "En direct" row at the top of the Feed: lives on right now, and a button
// to start one. Hidden until the server has its media server (LiveKit).
function LiveStrip() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { blockedIds } = useConversations()
  const { requireVerified } = useIdentity()
  const { showToast } = useToast()
  const [available, setAvailable] = useState(false)
  const [lives, setLives] = useState([])
  const [askTitle, setAskTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchLivesAvailable().then((ok) => !cancelled && setAvailable(ok))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => (available ? subscribeToLivesNow(setLives) : undefined), [available])

  const visible = useMemo(
    () => lives.filter((l) => l.hostId !== user?.id && !blockedIds?.has?.(l.hostId)),
    [lives, user?.id, blockedIds],
  )
  const mine = lives.find((l) => l.hostId === user?.id)

  async function go() {
    setStarting(true)
    try {
      const { liveId } = await startLive(title)
      navigate(`/lives/${liveId}`)
    } catch (err) {
      showToast(err.message, 'error')
      setStarting(false)
    }
  }

  if (!available) return null

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-coral-500" />
          En direct
        </p>
        <button
          type="button"
          onClick={() => (mine ? navigate(`/lives/${mine.id}`) : requireVerified('lives') && setAskTitle(true))}
          className="flex items-center gap-1.5 rounded-full bg-coral-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        >
          <Radio size={13} strokeWidth={2.5} />
          {mine ? 'Reprendre mon live' : 'Lancer un live'}
        </button>
      </div>

      {visible.length > 0 ? (
        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
          {visible.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate(`/lives/${l.id}`)}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span className="relative rounded-full bg-gradient-to-br from-coral-500 to-pink-500 p-[2px]">
                <img
                  src={photoVariant(l.hostPhoto, 'thumb') || l.hostPhoto || fallbackAvatar(l.hostName || l.id)}
                  onError={l.hostPhoto ? fallbackToFullPhoto(l.hostPhoto) : undefined}
                  alt=""
                  className="h-14 w-14 rounded-full border-2 border-surface-soft object-cover"
                />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-coral-500 px-1.5 text-[9px] font-bold uppercase text-white">
                  Live
                </span>
              </span>
              <span className="max-w-full truncate text-xs font-medium text-ink-soft/70">{l.hostName}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-soft/60">Personne n'est en live pour l'instant. Lance le tien !</p>
      )}

      {askTitle && (
        <Modal onClose={() => !starting && setAskTitle(false)}>
          <Radio size={30} strokeWidth={1.75} className="mx-auto text-coral-500" />
          <h2 className="mt-2 text-center font-display text-lg font-semibold text-ink">Lancer un live</h2>
          <p className="mt-1 text-center text-xs text-ink-soft/70">
            Tes matchs seront prévenus. Reste respectueux·se : la modération peut couper un live à tout moment.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            autoFocus
            placeholder="Titre (facultatif) : ex. On parle musique 🎶"
            className="mt-4 w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet-400 dark:bg-surface-tint"
          />
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" disabled={starting} onClick={() => setAskTitle(false)}>
              Annuler
            </Button>
            <Button className="flex-1" disabled={starting} onClick={go}>
              {starting ? 'Lancement…' : 'Passer en live'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default LiveStrip
