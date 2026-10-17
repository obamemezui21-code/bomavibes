import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, RefreshCw, UserPlus, Users, Video, VideoOff, Volume2 } from 'lucide-react'
import { useGroupCall } from '../context/GroupCallContext.jsx'
import { MAX_GROUP_CALL_MEMBERS } from '../firebase/groupCalls.js'
import GroupCallPicker from './GroupCallPicker.jsx'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function Avatar({ photo, name, size = 'h-20 w-20', text = 'text-2xl' }) {
  return photo ? (
    <img src={photo} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} ${text} flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 font-bold text-white`}>
      {name?.[0] || '?'}
    </span>
  )
}

// One person in the mosaic: their camera, or their photo when it's off.
function Tile({ p }) {
  const videoRef = useRef(null)
  useEffect(() => {
    const el = videoRef.current
    if (!p.videoTrack || !el) return undefined
    p.videoTrack.attach(el)
    return () => {
      p.videoTrack.detach(el)
    }
  }, [p.videoTrack])

  return (
    <div
      className={`relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800 transition-shadow ${
        p.isSpeaking ? 'ring-4 ring-mint-400' : 'ring-1 ring-white/10'
      }`}
    >
      {p.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${p.isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <Avatar photo={p.photo} name={p.name} />
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1 truncate rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white">
        {!p.micOn && <MicOff size={12} className="shrink-0 text-coral-400" />}
        {p.isLocal ? 'Vous' : p.name || 'Invité'}
      </span>
    </div>
  )
}

function gridClass(count) {
  if (count <= 1) return 'grid-cols-1 grid-rows-1'
  if (count === 2) return 'grid-cols-1 grid-rows-2'
  if (count <= 4) return 'grid-cols-2 grid-rows-2'
  if (count <= 6) return 'grid-cols-2 grid-rows-3'
  return 'grid-cols-2 grid-rows-4'
}

function ControlButton({ onClick, label, active = true, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
        danger ? 'bg-coral-500 text-white' : active ? 'bg-white/15 text-white' : 'bg-white text-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

function GroupCallScreen() {
  const {
    invite,
    session,
    callDoc,
    participants,
    micOn,
    cameraOn,
    audioBlocked,
    acceptInvite,
    declineInvite,
    addPeople,
    leave,
    toggleMic,
    toggleCamera,
    flipCamera,
    resumeAudio,
  } = useGroupCall()
  const [showPicker, setShowPicker] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Call timer, from the moment this device is connected.
  const isActive = session?.phase === 'active'
  useEffect(() => {
    if (!isActive) return undefined
    const startedAt = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 1000)
    return () => clearInterval(id)
  }, [isActive])

  // An invitation ringing on this device.
  if (invite && !session) {
    const others = (invite.members?.length || 1) - 1
    return (
      <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-gradient-to-b from-violet-950 to-zinc-950 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-white">
        <div className="flex flex-col items-center text-center">
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
            <Avatar photo={invite.hostPhoto} name={invite.hostName} size="h-28 w-28" text="text-4xl" />
          </motion.div>
          <p className="mt-5 font-display text-2xl font-bold">{invite.hostName || 'Un match'}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
            <Users size={15} /> Appel de groupe {invite.type === 'video' ? 'vidéo' : 'audio'} · {others} invité{others > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <div className="flex flex-col items-center gap-2">
            <ControlButton onClick={declineInvite} label="Refuser" danger>
              <PhoneOff size={24} />
            </ControlButton>
            <span className="text-xs text-white/70">Refuser</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={acceptInvite}
              aria-label="Rejoindre"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-500 text-white"
            >
              {invite.type === 'video' ? <Video size={24} /> : <Phone size={24} />}
            </button>
            <span className="text-xs text-white/70">Rejoindre</span>
          </div>
        </div>
      </div>
    )
  }

  if (!session) return null

  const ringingCount = callDoc?.ringing?.length || 0
  const members = callDoc?.members || []
  const status =
    session.phase === 'ended'
      ? session.endReason
      : session.phase === 'connecting'
        ? 'Connexion…'
        : participants.length <= 1
          ? ringingCount
            ? `Ça sonne chez ${ringingCount} personne${ringingCount > 1 ? 's' : ''}…`
            : 'En attente des participants…'
          : formatDuration(elapsed)

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-zinc-950 text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users size={16} /> Appel de groupe · {participants.length || 1}
          </p>
          <p className="text-xs text-white/60">{status}</p>
        </div>
        {audioBlocked && (
          <button
            type="button"
            onClick={resumeAudio}
            className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-900"
          >
            <Volume2 size={14} /> Activer le son
          </button>
        )}
      </div>

      <div className={`grid min-h-0 flex-1 gap-2 px-2 ${gridClass(participants.length)}`}>
        {participants.map((p) => (
          <Tile key={p.identity} p={p} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <ControlButton onClick={toggleMic} label={micOn ? 'Couper le micro' : 'Activer le micro'} active={micOn}>
          {micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </ControlButton>
        <ControlButton onClick={toggleCamera} label={cameraOn ? 'Couper la caméra' : 'Activer la caméra'} active={cameraOn}>
          {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
        </ControlButton>
        {cameraOn && (
          <ControlButton onClick={flipCamera} label="Changer de caméra">
            <RefreshCw size={20} />
          </ControlButton>
        )}
        {session.phase === 'active' && members.length < MAX_GROUP_CALL_MEMBERS && (
          <ControlButton onClick={() => setShowPicker(true)} label="Ajouter quelqu’un">
            <UserPlus size={22} />
          </ControlButton>
        )}
        <ControlButton onClick={leave} label="Quitter l’appel" danger>
          <PhoneOff size={22} />
        </ControlButton>
      </div>

      {showPicker && (
        <GroupCallPicker
          title="Ajouter à l’appel"
          excludeIds={members.filter((id) => !(callDoc?.declined || []).includes(id))}
          slotsLeft={MAX_GROUP_CALL_MEMBERS - members.length}
          onClose={() => setShowPicker(false)}
          onConfirm={(ids) => {
            setShowPicker(false)
            addPeople(ids)
          }}
        />
      )}
    </div>
  )
}

export default GroupCallScreen
