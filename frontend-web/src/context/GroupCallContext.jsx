import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import { useCall } from './CallContext.jsx'
import {
  createGroupCall,
  fetchGroupCallsAvailable,
  declineGroupCall,
  inviteToGroupCall,
  joinGroupCall,
  leaveGroupCall,
  subscribeToGroupCall,
  subscribeToGroupInvites,
} from '../firebase/groupCalls.js'
import { playNotificationSound } from '../lib/notificationSound.js'

const GroupCallScreen = lazy(() => import('../components/GroupCallScreen.jsx'))

const GroupCallContext = createContext(null)
const END_SCREEN_MS = 1500

// What the screen needs from one LiveKit participant, as plain data.
function describe(participant, isLocal) {
  let photo = null
  try {
    photo = JSON.parse(participant.metadata || '{}').photo || null
  } catch {
    // no metadata
  }
  const camera = participant.getTrackPublication('camera')
  const mic = participant.getTrackPublication('microphone')
  return {
    identity: participant.identity,
    name: participant.name || '',
    photo,
    isLocal,
    isSpeaking: participant.isSpeaking,
    micOn: !!mic && !mic.isMuted,
    videoTrack: camera && !camera.isMuted ? camera.track || null : null,
  }
}

// Group calls (up to 8 people) through the LiveKit media server. Separate
// from CallContext, which keeps handling 1-to-1 calls phone to phone.
export function GroupCallProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { call: oneToOneCall } = useCall()

  const [invite, setInvite] = useState(null)
  // { callId, type, phase: 'connecting' | 'active' | 'ended', endReason }
  const [session, setSession] = useState(null)
  const [callDoc, setCallDoc] = useState(null)
  const [participants, setParticipants] = useState([])
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)

  const roomRef = useRef(null)
  const sessionRef = useRef(null)
  const audioElsRef = useRef(new Map())
  const facingRef = useRef('user')

  const updateSession = useCallback((patch) => {
    sessionRef.current = patch === null ? null : { ...sessionRef.current, ...patch }
    setSession(sessionRef.current)
  }, [])

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    setParticipants([
      describe(room.localParticipant, true),
      ...[...room.remoteParticipants.values()].map((p) => describe(p, false)),
    ])
  }, [])

  const teardown = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null
    audioElsRef.current.forEach((el) => el.remove())
    audioElsRef.current.clear()
    room?.removeAllListeners()
    room?.disconnect().catch(() => {})
    setParticipants([])
    setAudioBlocked(false)
  }, [])

  const finish = useCallback(
    (reason = 'Appel terminé') => {
      const current = sessionRef.current
      if (!current || current.phase === 'ended') return
      teardown()
      leaveGroupCall(current.callId).catch(() => {})
      updateSession({ phase: 'ended', endReason: reason })
      setTimeout(() => {
        if (sessionRef.current?.phase === 'ended') {
          updateSession(null)
          setCallDoc(null)
        }
      }, END_SCREEN_MS)
    },
    [teardown, updateSession],
  )

  async function connect(callId, type) {
    updateSession({ callId, type, phase: 'connecting', endReason: null })
    setMicOn(true)
    setCameraOn(type === 'video')
    facingRef.current = 'user'
    try {
      const [{ Room, RoomEvent }, { url, token }] = await Promise.all([import('livekit-client'), joinGroupCall(callId)])
      if (sessionRef.current?.callId !== callId) return // hung up meanwhile
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room
        .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === 'audio') {
            const el = track.attach()
            el.dataset.participant = participant.identity
            document.body.appendChild(el)
            audioElsRef.current.set(track.sid, el)
          }
          refreshParticipants()
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach()
          audioElsRef.current.get(track.sid)?.remove()
          audioElsRef.current.delete(track.sid)
          refreshParticipants()
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
        .on(RoomEvent.Disconnected, () => finish('Connexion perdue'))
      for (const event of [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.ParticipantMetadataChanged,
      ]) {
        room.on(event, refreshParticipants)
      }

      await room.connect(url, token)
      await room.localParticipant.setMicrophoneEnabled(true).catch(() => setMicOn(false))
      if (type === 'video') {
        await room.localParticipant
          .setCameraEnabled(true, { facingMode: 'user', resolution: { width: 640, height: 480 } })
          .catch(() => setCameraOn(false))
      }
      setAudioBlocked(!room.canPlaybackAudio)
      updateSession({ phase: 'active' })
      refreshParticipants()
    } catch (err) {
      showToast(err.message || 'Impossible de rejoindre l’appel de groupe.', 'error')
      teardown()
      updateSession(null)
    }
  }

  async function startGroupCall(type, inviteeIds) {
    if (sessionRef.current || oneToOneCall) {
      showToast('Vous êtes déjà en appel.', 'info')
      return
    }
    updateSession({ callId: null, type, phase: 'connecting' })
    try {
      const { callId } = await createGroupCall(type, inviteeIds)
      sessionRef.current = null
      await connect(callId, type)
    } catch (err) {
      updateSession(null)
      showToast(err.message, 'error')
    }
  }

  function acceptInvite() {
    const current = invite
    if (!current) return
    setInvite(null)
    connect(current.id, current.type)
  }

  function declineInvite() {
    if (!invite) return
    declineGroupCall(invite.id).catch(() => {})
    setInvite(null)
  }

  async function addPeople(ids) {
    const callId = sessionRef.current?.callId
    if (!callId || ids.length === 0) return
    try {
      const { invited } = await inviteToGroupCall(callId, ids)
      if (invited) showToast(invited > 1 ? `${invited} personnes invitées` : 'Invitation envoyée', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function toggleMic() {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    setMicOn(next)
    await room.localParticipant.setMicrophoneEnabled(next).catch(() => setMicOn(!next))
    refreshParticipants()
  }

  async function toggleCamera() {
    const room = roomRef.current
    if (!room) return
    const next = !cameraOn
    setCameraOn(next)
    await room.localParticipant
      .setCameraEnabled(next, { facingMode: facingRef.current, resolution: { width: 640, height: 480 } })
      .catch(() => {
        setCameraOn(!next)
        showToast('Caméra indisponible.', 'error')
      })
    refreshParticipants()
  }

  async function flipCamera() {
    const track = roomRef.current?.localParticipant.getTrackPublication('camera')?.track
    if (!track) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    try {
      await track.restartTrack({ facingMode: next })
      facingRef.current = next
    } catch {
      showToast('Impossible de changer de caméra.', 'error')
    }
  }

  function leave() {
    finish('Vous avez quitté l’appel')
  }

  function resumeAudio() {
    roomRef.current
      ?.startAudio()
      .then(() => setAudioBlocked(false))
      .catch(() => {})
  }

  // Whether the server has a media server at all (the 👥 button hides otherwise).
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    fetchGroupCallsAvailable()
      .then((ok) => !cancelled && setAvailable(ok))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Invitations, app-wide. Not while already on a call of either kind.
  useEffect(() => {
    if (!user?.id) return undefined
    return subscribeToGroupInvites(user.id, (invites) => setInvite(invites[0] || null))
  }, [user?.id])

  const ringing = !!invite && !session && !oneToOneCall
  useEffect(() => {
    if (!ringing) return undefined
    const ring = () => {
      playNotificationSound()
      navigator.vibrate?.([300, 200, 300])
    }
    ring()
    const interval = setInterval(ring, 2000)
    return () => {
      clearInterval(interval)
      navigator.vibrate?.(0)
    }
  }, [ringing])

  // Follow the call doc: who's invited / ringing, and the end of the call.
  const callId = session?.callId
  useEffect(() => {
    if (!callId) return undefined
    return subscribeToGroupCall(callId, (doc) => {
      setCallDoc(doc)
      if (doc?.status === 'ended') finish('Appel terminé')
    })
  }, [callId, finish])

  // Leave cleanly when the tab closes or the user signs out.
  useEffect(() => {
    function handleUnload() {
      const current = sessionRef.current
      if (current?.callId && current.phase !== 'ended') leaveGroupCall(current.callId).catch(() => {})
    }
    window.addEventListener('pagehide', handleUnload)
    return () => window.removeEventListener('pagehide', handleUnload)
  }, [])

  useEffect(() => {
    if (!user?.id && sessionRef.current) {
      teardown()
      updateSession(null)
    }
  }, [user?.id, teardown, updateSession])

  const visibleInvite = ringing ? invite : null
  const value = {
    available,
    invite: visibleInvite,
    session,
    callDoc,
    participants,
    micOn,
    cameraOn,
    audioBlocked,
    startGroupCall,
    acceptInvite,
    declineInvite,
    addPeople,
    leave,
    toggleMic,
    toggleCamera,
    flipCamera,
    resumeAudio,
  }

  return (
    <GroupCallContext.Provider value={value}>
      {children}
      {(session || visibleInvite) && (
        <Suspense fallback={null}>
          <GroupCallScreen />
        </Suspense>
      )}
    </GroupCallContext.Provider>
  )
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext)
  if (!ctx) throw new Error('useGroupCall must be used inside GroupCallProvider')
  return ctx
}
