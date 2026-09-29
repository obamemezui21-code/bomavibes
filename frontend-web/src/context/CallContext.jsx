import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import { useConversations } from './ConversationsContext.jsx'
import {
  RING_TIMEOUT_MS,
  addCandidate,
  answerCall,
  answerIceRestart,
  createCall,
  fetchIceServers,
  markCallDelivered,
  recordCallInChat,
  requestIceRestart,
  setCallStatus,
  subscribeToCall,
  subscribeToIncomingCalls,
  subscribeToRemoteCandidates,
} from '../firebase/calls.js'
import { sendPushNotification } from '../firebase/notify.js'
import { playNotificationSound, startRingback } from '../lib/notificationSound.js'
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

// Recovery when the connection drops (network switch, TURN fallback needed…):
// the caller renegotiates with an ICE restart instead of hanging up.
// A brief "disconnected" often heals by itself — wait a little first.
const DISCONNECT_BEFORE_RESTART_MS = 3 * 1000
// Time given to each restart attempt before trying again.
const RESTART_RETRY_MS = 8 * 1000
const MAX_ICE_RESTARTS = 2
// Give up if the call hasn't recovered this long after the drop.
const RECOVERY_TIMEOUT_MS = 25 * 1000

const ROUTE_LABELS = {
  host: 'direct (même réseau)',
  srflx: 'direct (via STUN)',
  prflx: 'direct',
  relay: 'relais TURN',
}

// Call history: the caller (the only side that always knows how the call
// went) leaves a 'call' message in the conversation when it ends.
function logCallInChat(call, reason) {
  if (call?.role !== 'caller' || !call.id || !call.matchId || !call.selfId) return
  const answered = !!call.startedAt
  const outcome = answered
    ? 'completed'
    : { missed: 'missed', declined: 'declined', busy: 'busy', failed: 'failed' }[reason] || 'cancelled'
  recordCallInChat({
    matchId: call.matchId,
    callerId: call.selfId,
    calleeId: call.otherUid,
    type: call.type,
    outcome,
    duration: answered ? (Date.now() - call.startedAt) / 1000 : 0,
  }).catch(() => {})
}

function remoteUfrag(pc) {
  return pc.remoteDescription?.sdp?.match(/a=ice-ufrag:(\S+)/)?.[1] || null
}

// Which path the call ended up on — logged for diagnosing TURN (no
// credentials in there, only the candidate type and protocol).
async function logSelectedRoute(pc) {
  try {
    const stats = await pc.getStats()
    let pairId = null
    stats.forEach((r) => {
      if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId
    })
    let pair = null
    stats.forEach((r) => {
      if (pairId ? r.id === pairId : r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r
    })
    const local = pair && stats.get(pair.localCandidateId)
    if (!local) return
    const label = ROUTE_LABELS[local.candidateType] || local.candidateType
    console.info(`[appel] connecté — ${label}${local.protocol ? ` / ${local.protocol}` : ''}`)
  } catch {
    // Stats are diagnostic only.
  }
}

function mediaConstraints(type, facingMode = 'user') {
  return {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: type === 'video' ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  }
}

export function CallProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const { showToast } = useToast()
  const { conversations } = useConversations()

  // What the call screen renders. `phase`: incoming | outgoing | connecting | active | ended
  const [call, setCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  // Media connection health: idle | connecting | connected | reconnecting
  const [connectionStatus, setConnectionStatus] = useState('idle')

  const callRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const unsubsRef = useRef([])
  const timersRef = useRef([])
  const pendingRemoteCandidatesRef = useRef([])
  // ICE restart bookkeeping
  const restartVersionRef = useRef(0) // caller: latest restart sent
  const handledRestartRef = useRef(0) // callee: latest restart answered
  const restartAttemptsRef = useRef(0)
  const recoveryTimerRef = useRef(null)
  const retryTimerRef = useRef(null)

  const updateCall = useCallback((patch) => {
    callRef.current = callRef.current ? { ...callRef.current, ...patch } : null
    setCall(callRef.current)
  }, [])

  const teardown = useCallback(() => {
    unsubsRef.current.forEach((unsub) => unsub())
    unsubsRef.current = []
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
    clearTimeout(recoveryTimerRef.current)
    clearTimeout(retryTimerRef.current)
    recoveryTimerRef.current = null
    retryTimerRef.current = null
    restartVersionRef.current = 0
    handledRestartRef.current = 0
    restartAttemptsRef.current = 0
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
    setConnectionStatus('idle')
  }, [])

  // Stop media, show the end reason briefly, then close the call screen.
  const finish = useCallback(
    (reason) => {
      if (!callRef.current || callRef.current.phase === 'ended') return
      logCallInChat(callRef.current, reason)
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
    // iceServers = STUN + our TURN relay (from the backend). ICE tries direct
    // paths first and falls back to the relay candidates on its own when
    // direct ones fail; a small candidate pool speeds up call setup.
    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 })
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    setConnectionStatus('connecting')

    const remote = new MediaStream()
    setRemoteStream(remote)
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!remote.getTracks().includes(t)) remote.addTrack(t)
      })
      // New MediaStream identity so <video>/<audio> elements re-bind.
      setRemoteStream(new MediaStream(remote.getTracks()))
    }

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return
      const state = pc.connectionState
      if (state === 'connected') {
        clearTimeout(recoveryTimerRef.current)
        clearTimeout(retryTimerRef.current)
        recoveryTimerRef.current = null
        retryTimerRef.current = null
        restartAttemptsRef.current = 0
        setConnectionStatus('connected')
        if (callRef.current && callRef.current.phase !== 'active') {
          updateCall({ phase: 'active', startedAt: callRef.current.startedAt || Date.now() })
        }
        logSelectedRoute(pc)
      } else if (state === 'disconnected' || state === 'failed') {
        startRecovery(state)
      }
    }

    pcRef.current = pc
    return pc
  }

  // Connection lost: show "Reconnexion…", let the caller renegotiate (ICE
  // restart → may switch to the TURN relay), hang up only if nothing works.
  function startRecovery(state) {
    const current = callRef.current
    if (!current || current.phase === 'ended') return
    setConnectionStatus('reconnecting')

    if (!recoveryTimerRef.current) {
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null
        if (pcRef.current?.connectionState !== 'connected') hangUpWith('failed')
      }, RECOVERY_TIMEOUT_MS)
    }

    // Only the caller restarts, so both sides never send offers at once.
    // The callee waits for that offer (handled in watchCall).
    if (current.role !== 'caller') return
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(
      () => attemptIceRestart(),
      state === 'failed' ? 0 : DISCONNECT_BEFORE_RESTART_MS,
    )
  }

  async function attemptIceRestart() {
    const pc = pcRef.current
    const current = callRef.current
    retryTimerRef.current = null
    if (!pc || !current?.id || pc.connectionState === 'connected') return
    if (restartAttemptsRef.current >= MAX_ICE_RESTARTS) return
    // A restart is already waiting for its answer.
    if (pc.signalingState !== 'stable') return

    restartAttemptsRef.current += 1
    const version = restartVersionRef.current + 1
    restartVersionRef.current = version
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      await requestIceRestart(current.id, version, offer)
      console.info(`[appel] reconnexion (ICE restart ${version}/${MAX_ICE_RESTARTS})`)
    } catch {
      // Falls through to the retry below / the recovery timeout.
    }
    // Still not back after a while → one more attempt.
    retryTimerRef.current = setTimeout(() => {
      if (pcRef.current?.connectionState !== 'connected') {
        if (pcRef.current?.signalingState === 'have-local-offer') {
          pcRef.current.setLocalDescription({ type: 'rollback' }).catch(() => {})
        }
        attemptIceRestart()
      }
    }, RESTART_RETRY_MS)
  }

  function addRemoteCandidate(candidate) {
    const pc = pcRef.current
    if (!pc) return
    // Queue candidates that arrive before the matching remote description:
    // none set yet, or they belong to a newer ICE restart (different ufrag).
    const ufrag = remoteUfrag(pc)
    if (!pc.remoteDescription || (candidate.usernameFragment && ufrag && candidate.usernameFragment !== ufrag)) {
      pendingRemoteCandidatesRef.current.push(candidate)
      return
    }
    pc.addIceCandidate(candidate).catch(() => {})
  }

  function flushRemoteCandidates() {
    const queued = pendingRemoteCandidatesRef.current
    pendingRemoteCandidatesRef.current = []
    queued.forEach(addRemoteCandidate)
  }

  // Watch the call doc: the other side answering, declining or hanging up,
  // and ICE restarts in both directions.
  function watchCall(callId) {
    const unsub = subscribeToCall(callId, async (data) => {
      const pc = pcRef.current
      const role = callRef.current?.role
      if (data.answer && pc && !pc.currentRemoteDescription && role === 'caller') {
        try {
          await pc.setRemoteDescription(data.answer)
          flushRemoteCandidates()
          updateCall({ phase: 'connecting' })
        } catch {
          hangUpWith('failed')
        }
      }

      // Callee: answer the caller's restart offer.
      if (pc && role === 'callee' && data.restart?.version > handledRestartRef.current) {
        const { version, offer } = data.restart
        handledRestartRef.current = version
        setConnectionStatus('reconnecting')
        try {
          await pc.setRemoteDescription(offer)
          flushRemoteCandidates()
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await answerIceRestart(callId, version, answer)
        } catch {
          // The caller will retry or the recovery timeout ends the call.
        }
      }

      // Caller: apply the callee's answer to our latest restart.
      if (
        pc &&
        role === 'caller' &&
        data.restartAnswer?.version === restartVersionRef.current &&
        pc.signalingState === 'have-local-offer'
      ) {
        try {
          await pc.setRemoteDescription(data.restartAnswer.answer)
          flushRemoteCandidates()
        } catch {
          // Retry timer handles it.
        }
      }

      // Caller: the other phone has received the call and is ringing.
      if (role === 'caller' && data.deliveredAt && !callRef.current?.delivered) {
        updateCall({ delivered: true })
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
      callRef.current = { id: null, role: 'caller', phase: 'outgoing', type, matchId, otherUid, other, selfId: user.id }
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
        // Tell the caller this device is ringing.
        markCallDelivered(incoming.id).catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const phase = call?.phase

  // Ringback tone for the caller while the other side hasn't picked up.
  useEffect(() => {
    if (phase !== 'outgoing') return undefined
    return startRingback()
  }, [phase])

  // Ringtone + vibration while a call is ringing on this device.
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

  // Live presence of the person on the other end (same source as the chat:
  // their profile's lastActive heartbeat), shown while calling them.
  const otherConversation = call ? conversations.find((c) => c.id === call.matchId) : null
  const otherPresence = otherConversation
    ? { online: !!otherConversation.online, lastSeen: otherConversation.lastSeenLabel || null }
    : null

  const value = {
    call,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    facingMode,
    connectionStatus,
    otherPresence,
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

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used inside CallProvider')
  return ctx
}
