import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Flag, Heart, Mic, MicOff, Send, SwitchCamera, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { commentLive, endLive, joinLive, subscribeToLive, subscribeToLiveComments } from '../firebase/lives.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import ReportModal from '../components/ReportModal.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'

const HEART_COLORS = ['text-pink-500', 'text-coral-500', 'text-violet-500', 'text-heart-400']
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// One live, full screen: the host films, everyone else watches, comments and
// sends hearts (LiveKit data messages). Host and viewers share this page.
function LiveRoom() {
  const { liveId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [live, setLive] = useState(undefined) // undefined = loading, null = gone
  const [comments, setComments] = useState([])
  const [phase, setPhase] = useState('connecting') // connecting | live | ended
  const [isHost, setIsHost] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [hearts, setHearts] = useState([])
  const [draft, setDraft] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)

  const videoRef = useRef(null)
  const roomRef = useRef(null)
  const audioElsRef = useRef([])
  const facingRef = useRef('user')
  const [mirrored, setMirrored] = useState(true) // front camera shown as a mirror to the host
  const commentsEndRef = useRef(null)

  const popHeart = useCallback(() => {
    const id = Math.random().toString(36).slice(2)
    const heart = { id, x: Math.random() * 50 - 25, color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)] }
    setHearts((prev) => [...prev.slice(-20), heart])
    setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 2200)
  }, [])

  useEffect(() => subscribeToLive(liveId, setLive), [liveId])
  useEffect(() => subscribeToLiveComments(liveId, setComments), [liveId])
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: 'end' })
  }, [comments.length])

  // Connect to the LiveKit room once.
  useEffect(() => {
    let cancelled = false
    async function connect() {
      try {
        const [{ Room, RoomEvent, Track }, { url, token, isHost: host }] = await Promise.all([
          import('livekit-client'),
          joinLive(liveId),
        ])
        if (cancelled) return
        setIsHost(host)
        const room = new Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room
        room
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current)
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach()
              document.body.appendChild(el)
              audioElsRef.current.push(el)
            }
          })
          .on(RoomEvent.DataReceived, (payload) => {
            try {
              if (JSON.parse(decoder.decode(payload)).type === 'heart') popHeart()
            } catch {
              // not ours
            }
          })
          .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
          .on(RoomEvent.Disconnected, () => setPhase((p) => (p === 'live' ? 'ended' : p)))
        await room.connect(url, token)
        if (host) {
          await room.localParticipant.setMicrophoneEnabled(true).catch(() => setMicOn(false))
          await room.localParticipant.setCameraEnabled(true, { facingMode: 'user', resolution: { width: 720, height: 1280 } })
          const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
          if (cam && videoRef.current) cam.attach(videoRef.current)
        }
        setAudioBlocked(!room.canPlaybackAudio)
        if (!cancelled) setPhase('live')
      } catch (err) {
        if (!cancelled) {
          showToast(err.message || 'Impossible de rejoindre le live.', 'error')
          setPhase('ended')
        }
      }
    }
    connect()
    return () => {
      cancelled = true
      audioElsRef.current.forEach((el) => el.remove())
      audioElsRef.current = []
      roomRef.current?.removeAllListeners()
      roomRef.current?.disconnect().catch(() => {})
      roomRef.current = null
    }
  }, [liveId, popHeart, showToast])

  function sendHeart() {
    popHeart()
    roomRef.current?.localParticipant
      .publishData(encoder.encode(JSON.stringify({ type: 'heart' })), { reliable: false })
      .catch(() => {})
  }

  async function sendComment(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      await commentLive(liveId, text)
    } catch (err) {
      setDraft(text)
      showToast(err.message, 'error')
    }
  }

  async function toggleMic() {
    const next = !micOn
    setMicOn(next)
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next).catch(() => setMicOn(!next))
  }

  async function flipCamera() {
    const { Track } = await import('livekit-client')
    const cam = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.track
    if (!cam) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    try {
      await cam.restartTrack({ facingMode: next })
      facingRef.current = next
      setMirrored(next === 'user')
    } catch {
      showToast('Impossible de changer de caméra.', 'error')
    }
  }

  async function stopLive() {
    setConfirmEnd(false)
    await endLive(liveId).catch(() => {})
    navigate('/feed')
  }

  async function handleReport(reason, description, alsoBlock) {
    try {
      await reportUser(user.id, live.hostId, reason, description, { liveId })
      showToast('Signalement envoyé. Merci !', 'success')
      setShowReport(false)
      if (alsoBlock) {
        await blockUser(user.id, live.hostId)
        navigate('/feed')
      }
    } catch {
      showToast("Impossible d'envoyer le signalement.", 'error')
    }
  }

  const ended = phase === 'ended' || live === null || live?.status === 'ended'

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost}
        className={`absolute inset-0 h-full w-full object-cover ${isHost && mirrored ? '-scale-x-100' : ''}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

      {/* Top bar */}
      <div className="relative flex items-center gap-2.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <img
          src={live?.hostPhoto || fallbackAvatar(live?.hostName || liveId)}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-2 ring-coral-500"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{live?.hostName}</p>
          {live?.title && <p className="truncate text-xs text-white/75">{live.title}</p>}
        </div>
        <span className="rounded bg-coral-500 px-2 py-0.5 text-[11px] font-bold uppercase">Live</span>
        <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs">
          <Eye size={12} strokeWidth={2.5} />
          {live?.viewers || 0}
        </span>
        {!isHost && live && (
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40"
            aria-label="Signaler ce live"
          >
            <Flag size={15} strokeWidth={2.25} />
          </button>
        )}
        <button
          type="button"
          onClick={() => (isHost && !ended ? setConfirmEnd(true) : navigate(-1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40"
          aria-label={isHost ? 'Arrêter le live' : 'Quitter'}
        >
          <X size={17} strokeWidth={2.25} />
        </button>
      </div>

      {phase === 'connecting' && !ended && (
        <div className="relative flex flex-1 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {ended && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-display text-xl font-semibold">Le live est terminé</p>
          {live?.endedBy === 'moderation' && (
            <p className="text-sm text-white/70">Ce live a été interrompu par la modération.</p>
          )}
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-ink"
          >
            Retour au fil
          </button>
        </div>
      )}

      {audioBlocked && !ended && (
        <button
          type="button"
          onClick={() => roomRef.current?.startAudio().then(() => setAudioBlocked(false))}
          className="relative mx-auto mt-4 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink"
        >
          🔊 Toucher pour activer le son
        </button>
      )}

      {!ended && phase === 'live' && (
        <>
          <div className="flex-1" />
          {/* Flying hearts */}
          <div className="pointer-events-none absolute bottom-28 right-6 h-64 w-16">
            <AnimatePresence>
              {hearts.map((h) => (
                <motion.span
                  key={h.id}
                  initial={{ opacity: 1, y: 0, x: 0, scale: 0.6 }}
                  animate={{ opacity: 0, y: -240, x: h.x, scale: 1.2 }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  className={`absolute bottom-0 right-0 ${h.color}`}
                >
                  <Heart size={28} fill="currentColor" strokeWidth={0} />
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* Comments */}
          <div className="relative max-h-[38svh] overflow-y-auto px-4 [mask-image:linear-gradient(to_bottom,transparent,black_25%)]">
            <div className="space-y-1.5 pt-8">
              {comments.map((c) => (
                <p key={c.id} className="max-w-[80%] text-sm leading-snug [overflow-wrap:anywhere] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                  <span className={`font-semibold ${c.authorId === live?.hostId ? 'text-coral-300' : 'text-white/80'}`}>
                    {c.authorName}
                  </span>{' '}
                  {c.text}
                </p>
              ))}
              <div ref={commentsEndRef} />
            </div>
          </div>

          {/* Bottom bar */}
          <form
            onSubmit={sendComment}
            className="relative flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              placeholder="Commenter…"
              className="min-w-0 flex-1 rounded-full bg-white/15 px-4 py-2.5 text-sm text-white placeholder-white/60 outline-none backdrop-blur-md focus:bg-white/25"
            />
            {draft.trim() ? (
              <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full bg-coral-500" aria-label="Envoyer">
                <Send size={17} strokeWidth={2.25} />
              </button>
            ) : isHost ? (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md"
                  aria-label={micOn ? 'Couper le micro' : 'Activer le micro'}
                >
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  type="button"
                  onClick={flipCamera}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md"
                  aria-label="Changer de caméra"
                >
                  <SwitchCamera size={18} />
                </button>
              </>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.8 }}
                onClick={sendHeart}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500"
                aria-label="Envoyer un cœur"
              >
                <Heart size={18} fill="currentColor" strokeWidth={0} />
              </motion.button>
            )}
          </form>
        </>
      )}

      {showReport && live && (
        <ReportModal firstName={live.hostName} onClose={() => setShowReport(false)} onSubmit={handleReport} />
      )}
      {confirmEnd && (
        <ConfirmModal
          title="Arrêter le live ?"
          description="Tous les spectateurs seront déconnectés."
          confirmLabel="Arrêter"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={stopLive}
        />
      )}
    </div>
  )
}

export default LiveRoom
