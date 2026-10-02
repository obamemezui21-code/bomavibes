import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, RefreshCw, Video, VideoOff } from 'lucide-react'
import { useCall } from '../context/CallContext.jsx'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function StreamVideo({ stream, muted, mirrored, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirrored ? '-scale-x-100' : ''}`}
    />
  )
}

// Audio-only calls still need an element to play the other side's sound.
function StreamAudio({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

function CallTimer({ startedAt }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <>{formatDuration(now - startedAt)}</>
}

function RoundButton({ onClick, label, children, tone = 'glass', size = 'md' }) {
  const tones = {
    glass: 'bg-white/15 text-white hover:bg-white/25',
    active: 'bg-white text-violet-950',
    danger: 'bg-coral-500 text-white shadow-lg shadow-coral-500/40',
    accept: 'bg-mint-500 text-white shadow-lg shadow-mint-500/40',
  }
  const sizes = { md: 'h-14 w-14', lg: 'h-16 w-16' }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onClick}
        aria-label={label}
        className={`flex items-center justify-center rounded-full backdrop-blur-md transition ${tones[tone]} ${sizes[size]}`}
      >
        {children}
      </motion.button>
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </div>
  )
}

// Full-screen call UI (deep violet, like the rest of the Friendzy-style
// messaging screens): incoming, ringing, connecting, in call, ended.
function CallScreen() {
  const {
    call,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
    flipCamera,
    facingMode,
    connectionStatus,
    otherPresence,
  } = useCall()

  if (!call) return null

  const isVideo = call.type === 'video'
  const other = call.other || {}
  const showRemoteVideo = isVideo && call.phase === 'active' && remoteStream?.getVideoTracks().length > 0
  const avatar =
    other.photo ||
    fallbackAvatar(other.firstName || 'BomaVibes', 'ead5ea')

  let statusText = ''
  if (call.phase === 'incoming') statusText = isVideo ? 'Appel vidéo entrant…' : 'Appel audio entrant…'
  // "Appel…" until the other phone confirms it received the call, then
  // "Ça sonne…" (like WhatsApp's Calling / Ringing).
  else if (call.phase === 'outgoing') statusText = call.delivered ? 'Ça sonne…' : 'Appel…'
  else if (call.phase === 'connecting') statusText = 'Connexion…'
  else if (call.phase === 'ended') statusText = call.endReason
  else if (connectionStatus === 'reconnecting') statusText = 'Reconnexion…'
  else if (call.phase === 'active' && call.startedAt) statusText = null
  const isReconnecting = call.phase !== 'ended' && connectionStatus === 'reconnecting'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-violet-950 text-white"
    >
      {remoteStream && !isVideo && <StreamAudio stream={remoteStream} />}

      {showRemoteVideo ? (
        <StreamVideo stream={remoteStream} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-heart-500/15 blur-[120px]" />
      )}
      {showRemoteVideo && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />}

      {/* Connection dropped: keep the call up while it recovers */}
      {isReconnecting && (
        <div className="absolute inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-20 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Connexion instable, reconnexion…
          </span>
        </div>
      )}

      {/* Own camera preview */}
      {isVideo && localStream && call.phase !== 'ended' && !isCameraOff && (
        <motion.div
          layout
          className={`absolute z-10 overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl ${
            showRemoteVideo
              ? 'right-4 top-[max(1rem,env(safe-area-inset-top))] h-40 w-28'
              : 'inset-0 rounded-none border-0 opacity-35'
          }`}
        >
          <StreamVideo stream={localStream} muted mirrored={facingMode === 'user'} className="h-full w-full object-cover" />
        </motion.div>
      )}

      {/* Name / avatar / status */}
      <div
        className={`relative z-10 flex flex-col items-center px-6 text-center ${
          showRemoteVideo ? 'pt-[max(1.25rem,env(safe-area-inset-top))] items-start text-left' : 'flex-1 justify-center'
        }`}
      >
        {!showRemoteVideo && (
          <div className="relative mb-8 flex items-center justify-center">
            {call.phase !== 'active' && call.phase !== 'ended' &&
              [0, 1, 2].map((ring) => (
                <motion.span
                  key={ring}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: [0.7, 1.9], opacity: [0.5, 0] }}
                  transition={{ duration: 2.6, delay: ring * 0.85, repeat: Infinity, ease: 'easeOut' }}
                  className="pointer-events-none absolute h-36 w-36 rounded-full border-2 border-white/40"
                />
              ))}
            <span className="block rounded-full bg-white/15 p-1.5">
              <img src={avatar} alt="" className="h-36 w-36 rounded-full border-4 border-violet-950 object-cover" />
            </span>
          </div>
        )}
        <h2 className="font-display text-2xl font-bold [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
          {other.firstName || 'Appel'}
        </h2>
        <p className="mt-1 text-sm text-white/70">
          {statusText ?? <CallTimer startedAt={call.startedAt} />}
          {call.phase === 'active' && !showRemoteVideo && ` · ${isVideo ? 'Vidéo' : 'Audio'}`}
        </p>

        {/* While calling: is the other person online right now? */}
        {call.role === 'caller' && call.phase === 'outgoing' && otherPresence && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
              <span
                className={`h-2.5 w-2.5 rounded-full ${otherPresence.online ? 'bg-mint-400' : 'bg-white/40'}`}
              />
              {otherPresence.online
                ? 'En ligne'
                : `Hors ligne${otherPresence.lastSeen ? ` · ${otherPresence.lastSeen}` : ''}`}
            </span>
            {!otherPresence.online && !call.delivered && (
              <span className="max-w-xs text-xs text-white/60">
                {other.firstName || 'Cette personne'} recevra une notification de votre appel.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 mt-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        {call.phase === 'incoming' ? (
          <div className="flex items-end justify-center gap-16">
            <RoundButton onClick={declineCall} label="Refuser" tone="danger" size="lg">
              <PhoneOff size={26} strokeWidth={2.25} />
            </RoundButton>
            <RoundButton onClick={acceptCall} label="Répondre" tone="accept" size="lg">
              {isVideo ? <Video size={26} strokeWidth={2.25} /> : <Phone size={26} strokeWidth={2.25} />}
            </RoundButton>
          </div>
        ) : call.phase === 'ended' ? null : (
          <div className="flex items-end justify-center gap-5">
            <RoundButton onClick={toggleMute} label={isMuted ? 'Micro coupé' : 'Micro'} tone={isMuted ? 'active' : 'glass'}>
              {isMuted ? <MicOff size={22} strokeWidth={2.25} /> : <Mic size={22} strokeWidth={2.25} />}
            </RoundButton>
            {isVideo && (
              <RoundButton
                onClick={toggleCamera}
                label={isCameraOff ? 'Caméra coupée' : 'Caméra'}
                tone={isCameraOff ? 'active' : 'glass'}
              >
                {isCameraOff ? <VideoOff size={22} strokeWidth={2.25} /> : <Video size={22} strokeWidth={2.25} />}
              </RoundButton>
            )}
            {isVideo && (
              <RoundButton onClick={flipCamera} label="Retourner">
                <RefreshCw size={22} strokeWidth={2.25} />
              </RoundButton>
            )}
            <RoundButton onClick={hangUp} label="Raccrocher" tone="danger">
              <PhoneOff size={22} strokeWidth={2.25} />
            </RoundButton>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default CallScreen
