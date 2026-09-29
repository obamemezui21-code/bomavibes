import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import {
  RING_TIMEOUT_MS,
  addCandidate,
  answerCall,
  createCall,
  fetchIceServers,
  setCallStatus,
  subscribeToCall,
  subscribeToIncomingCalls,
  subscribeToRemoteCandidates,
} from '../firebase/calls.js'
import { sendPushNotification } from '../firebase/notify.js'
import { playNotificationSound } from '../lib/notificationSound.js'
import { photoVariant } from '../lib/photoVariants.js'

const CallScreen = lazy(() => import('../components/CallScreen.jsx'))

const CallContext = createContext(null)

// Statuses after which a call is over for both sides.
const FINAL_STATUSES = ['ended', 'declined', 'missed', 'busy', 'cancelled']

const END_MESSAGES = {
  declined: 'Appel refusé',
  missed: 'Pas de réponse',
  busy: 'Occupé·e sur un autre appel',
  cancelled: 'Appel annulé',
  ended: 'Appel terminé',
  failed: 'Connexion perdue',
}

// How long the "Appel terminé" state stays on screen before closing.
const END_SCREEN_MS = 1600
// A connection that stays "disconnected" this long is treated as dropped.
const DISCONNECT_GRACE_MS = 10 * 1000

function mediaConstraints(type, facingMode = 'user') {
  return {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: type === 'video' ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  }
}

export function CallProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const { showToast } = useToast()

  // What the call screen renders. `phase`: incoming | outgoing | connecting | active | ended
  const [call, setCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [facingMode, setFacingMode] = useState('user')

  const callRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const unsubsRef = useRef([])
  const timersRef = useRef([])
  const pendingRemoteCandidatesRef = useRef([])

  const updateCall = useCallback((patch) => {
    callRef.current = callRef.current ? { ...callRef.current, ...patch } : null
    setCall(callRef.current)
  }, [])

  const teardown = useCallback(() => {
    unsubsRef.current.forEach((unsub) => unsub())
    unsubsRef.current = []
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
    pendingRemoteCandidatesRef.current = []
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onicecandidate = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setFacingMode('user')
  }, [])

  // Stop media, show the end reason briefly, then close the call screen.
  const finish = useCallback(
    (reason) => {
      if (!callRef.current || callRef.current.phase === 'ended') return
      teardown()
      updateCall({ phase: 'ended', endReason: END_MESSAGES[reason] || END_MESSAGES.ended })
      setTimeout(() => {
        if (callRef.current?.phase === 'ended') {
          callRef.current = null
          setCall(null)
        }
      }, END_SCREEN_MS)
    },
    [teardown, updateCall],
  )

  async function getMedia(type, facing = 'user') {
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(type, facing))
    localStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }

  function createPeerConnection(iceServers, stream) {
    const pc = new RTCPeerConnection({ iceServers })
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    const remote = new MediaStream()
    setRemoteStream(remote)
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!remote.getTracks().includes(t)) remote.addTrack(t)
      })
      // New MediaStream identity so <video>/<audio> elements re-bind.
      setRemoteStream(new MediaStream(remote.getTracks()))
    }

    let disconnectTimer = null
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        clearTimeout(disconnectTimer)
        if (callRef.current && callRef.current.phase !== 'active') {
          updateCall({ phase: 'active', startedAt: Date.now() })
        }
      } else if (state === 'disconnected') {
        disconnectTimer = setTimeout(() => {
          if (pc.connectionState !== 'connected') hangUpWith('failed')
        }, DISCONNECT_GRACE_MS)
        timersRef.current.push(disconnectTimer)
      } else if (state === 'failed') {
        hangUpWith('failed')
      }
    }

    pcRef.current = pc
    return pc
  }

  function addRemoteCandidate(candidate) {
    const pc = pcRef.current
    if (!pc) return
    // Candidates can arrive before the remote description is set — queue them.
    if (!pc.remoteDescription) {
      pendingRemoteCandidatesRef.current.push(candidate)
      return
    }
    pc.addIceCandidate(candidate).catch(() => {})
  }

  function flushRemoteCandidates() {
    const pc = pcRef.current
    const queued = pendingRemoteCandidatesRef.current
    pendingRemoteCandidatesRef.current = []
    queued.forEach((c) => pc?.addIceCandidate(c).catch(() => {}))
  }

  // Watch the call doc: the other side answering, declining or hanging up.
  function watchCall(callId) {
    const unsub = subscribeToCall(callId, async (data) => {
      const pc = pcRef.current
      if (data.answer && pc && !pc.currentRemoteDescription && callRef.current?.role === 'caller') {
        try {
          await pc.setRemoteDescription(data.answer)
          flushRemoteCandidates()
          updateCall({ phase: 'connecting' })
        } catch {
          hangUpWith('failed')
        }
      }
      if (FINAL_STATUSES.includes(data.status)) finish(data.status)
    })
    unsubsRef.current.push(unsub)
  }

  async function hangUpWith(reason) {
    const current = callRef.current
    if (!current || current.phase === 'ended') return
    if (current.id) {
      let status = 'ended'
      if (current.phase === 'outgoing') status = reason === 'missed' ? 'missed' : 'cancelled'
      if (current.phase === 'incoming') status = 'declined'
      setCallStatus(current.id, status).catch(() => {})
    }
    finish(reason)
  }

  const startCall = useCallback(
    async ({ matchId, otherUid, other, type }) => {
      if (!user?.id || callRef.current) return
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        showToast("Votre navigateur ne permet pas les appels.", 'error')
        return
      }

      const me = {
        firstName: publicProfile?.firstName || user.firstName || '',
        photo: photoVariant(publicProfile?.photos?.[0], 'thumb') || null,
      }
      callRef.current = { id: null, role: 'caller', phase: 'outgoing', type, matchId, otherUid, other }
      setCall(callRef.current)

      let stream
      try {
        stream = await getMedia(type)
      } catch {
        callRef.current = null
        setCall(null)
        showToast(
          type === 'video'
            ? 'Autorisez l’accès au micro et à la caméra pour appeler.'
            : 'Autorisez l’accès au micro pour appeler.',
          'error',
        )
        return
      }

      try {
        const iceServers = await fetchIceServers()
        if (!callRef.current) return // cancelled while fetching
        const pc = createPeerConnection(iceServers, stream)

        // Candidates found before the call doc exists wait here.
        const localCandidates = []
        let callId = null
        pc.onicecandidate = (e) => {
          if (!e.candidate) return
          if (callId) addCandidate(callId, 'caller', e.candidate).catch(() => {})
          else localCandidates.push(e.candidate)
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        callId = await createCall({
          callerId: user.id,
          calleeId: otherUid,
          matchId,
          type,
          offer: { type: offer.type, sdp: offer.sdp },
          caller: me,
          callee: other,
        })
        if (!callRef.current) {
          setCallStatus(callId, 'cancelled').catch(() => {})
          return
        }
        updateCall({ id: callId })
        localCandidates.forEach((c) => addCandidate(callId, 'caller', c).catch(() => {}))

        watchCall(callId)
        unsubsRef.current.push(subscribeToRemoteCandidates(callId, 'caller', addRemoteCandidate))

        timersRef.current.push(
          setTimeout(() => {
            if (callRef.current?.id === callId && callRef.current.phase === 'outgoing') hangUpWith('missed')
          }, RING_TIMEOUT_MS),
        )

        sendPushNotification(otherUid, 'call', { firstName: me.firstName, callType: type, matchId, callId })
      } catch {
        showToast("Impossible de lancer l'appel, réessayez.", 'error')
        hangUpWith('failed')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, publicProfile, showToast],
  )

  async function acceptCall() {
    const current = callRef.current
    if (!current || current.phase !== 'incoming') return
    updateCall({ phase: 'connecting' })

    let stream
    try {
      stream = await getMedia(current.type)
    } catch {
      showToast(
        current.type === 'video'
          ? 'Autorisez l’accès au micro et à la caméra pour répondre.'
          : 'Autorisez l’accès au micro pour répondre.',
        'error',
      )
      setCallStatus(current.id, 'declined').catch(() => {})
      finish('declined')
      return
    }

    try {
      const iceServers = await fetchIceServers()
      if (callRef.current?.id !== current.id) return
      const pc = createPeerConnection(iceServers, stream)
      pc.onicecandidate = (e) => {
        if (e.candidate) addCandidate(current.id, 'callee', e.candidate).catch(() => {})
      }
      unsubsRef.current.push(subscribeToRemoteCandidates(current.id, 'callee', addRemoteCandidate))

      await pc.setRemoteDescription(current.offer)
      flushRemoteCandidates()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await answerCall(current.id, { type: answer.type, sdp: answer.sdp })
    } catch {
      showToast("Impossible de rejoindre l'appel.", 'error')
      hangUpWith('failed')
    }
  }

  function declineCall() {
    hangUpWith('declined')
  }

  function hangUp() {
    hangUpWith('ended')
  }

  function toggleMute() {
    const tracks = localStreamRef.current?.getAudioTracks() || []
    const next = !isMuted
    tracks.forEach((t) => {
      t.enabled = !next
    })
    setIsMuted(next)
  }

  function toggleCamera() {
    const tracks = localStreamRef.current?.getVideoTracks() || []
    const next = !isCameraOff
    tracks.forEach((t) => {
      t.enabled = !next
    })
    setIsCameraOff(next)
  }

  // Front ⇄ back camera on phones: grab the other camera and swap the track
  // being sent, without renegotiating the call.
  async function flipCamera() {
    const pc = pcRef.current
    const stream = localStreamRef.current
    if (!pc || !stream || callRef.current?.type !== 'video') return
    const next = facingMode === 'user' ? 'environment' : 'user'
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } })
      const newTrack = fresh.getVideoTracks()[0]
      newTrack.enabled = !isCameraOff
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      await sender?.replaceTrack(newTrack)
      stream.getVideoTracks().forEach((t) => {
        t.stop()
        stream.removeTrack(t)
      })
      stream.addTrack(newTrack)
      setLocalStream(new MediaStream(stream.getTracks()))
      setFacingMode(next)
    } catch {
      showToast("Impossible de changer de caméra.", 'error')
    }
  }

  // Incoming calls, app-wide.
  useEffect(() => {
    if (!user?.id) return undefined
    return subscribeToIncomingCalls(user.id, (calls) => {
      const incoming = calls[0]
      const current = callRef.current
      if (!incoming) {
        // Caller cancelled / call timed out before we answered.
        if (current?.phase === 'incoming') finish('cancelled')
        return
      }
      if (current && current.id !== incoming.id) {
        // Already on a call: tell the new caller we're busy.
        calls.forEach((c) => setCallStatus(c.id, 'busy').catch(() => {}))
        return
      }
      if (!current) {
        callRef.current = {
          id: incoming.id,
          role: 'callee',
          phase: 'incoming',
          type: incoming.type,
          matchId: incoming.matchId,
          otherUid: incoming.callerId,
          other: { firstName: incoming.callerName, photo: incoming.callerPhoto },
          offer: incoming.offer,
        }
        setCall(callRef.current)
        watchCall(incoming.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Ringtone + vibration while a call is ringing on this device.
  const phase = call?.phase
  useEffect(() => {
    if (phase !== 'incoming') return undefined
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
  }, [phase])

  // Hang up cleanly if the tab is closed mid-call.
  useEffect(() => {
    function handleUnload() {
      const current = callRef.current
      if (current?.id && current.phase !== 'ended') {
        setCallStatus(current.id, current.phase === 'incoming' ? 'declined' : 'ended').catch(() => {})
      }
    }
    window.addEventListener('pagehide', handleUnload)
    return () => window.removeEventListener('pagehide', handleUnload)
  }, [])

  // Signing out ends any call in progress.
  useEffect(() => {
    if (!user?.id && callRef.current) {
      teardown()
      callRef.current = null
      setCall(null)
    }
  }, [user?.id, teardown])

  const value = {
    call,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    facingMode,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
    flipCamera,
  }

  return (
    <CallContext.Provider value={value}>
      {children}
      {call && (
        <Suspense fallback={null}>
          <CallScreen />
        </Suspense>
      )}
    </CallContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used inside CallProvider')
  return ctx
}
