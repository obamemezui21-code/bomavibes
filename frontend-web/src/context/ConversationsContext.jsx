import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { sendPushNotification } from '../firebase/notify.js'
import { enablePushForUser } from '../firebase/push.js'
import { fetchBlockedIds } from '../firebase/safety.js'
import { playNotificationSound } from '../lib/notificationSound.js'
import { photoVariant } from '../lib/photoVariants.js'
import { messagePreviewText } from '../lib/messagePreview.js'
import { useAuth } from './AuthContext.jsx'

const ConversationsContext = createContext(null)
const ONLINE_THRESHOLD_MS = 150 * 1000
const TYPING_THRESHOLD_MS = 6 * 1000
const HEARTBEAT_INTERVAL_MS = 90 * 1000

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isRecent(timestamp, thresholdMs, now) {
  const ms = timestamp?.toMillis?.()
  return !!ms && now - ms < thresholdMs
}

function formatLastSeen(timestamp, now) {
  const ms = timestamp?.toMillis?.()
  if (!ms) return null
  const diffMin = Math.floor((now - ms) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `Vu il y a ${diffMin} min`
  const date = new Date(ms)
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const today = new Date(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return `Vu aujourd'hui à ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Vu hier à ${time}`
  return `Vu le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${time}`
}

export function ConversationsProvider({ children }) {
  const { user, profile } = useAuth()
  const uid = user?.id
  const [matches, setMatches] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [blockedIds, setBlockedIds] = useState(new Set())
  const [activeMessages, setActiveMessages] = useState({})
  const [openMatchId, setOpenMatchId] = useState(null)
  const [now, setNow] = useState(Date.now())
  const prevSeenRef = useRef({})
  const isFirstMatchesSnapshot = useRef(true)
  const hasTriedPushRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15 * 1000)
    return () => clearInterval(timer)
  }, [])

  async function refreshBlockedIds() {
    if (!uid) return
    setBlockedIds(await fetchBlockedIds(uid))
  }

  useEffect(() => {
    if (!uid) {
      setBlockedIds(new Set())
      return
    }
    refreshBlockedIds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const [showPushPrompt, setShowPushPrompt] = useState(false)

  useEffect(() => {
    if (!uid || !profile || hasTriedPushRef.current) return
    if (profile.fcmTokens?.length) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return
    hasTriedPushRef.current = true
    setShowPushPrompt(true)
  }, [uid, profile])

  async function acceptPushPrompt() {
    setShowPushPrompt(false)
    await enablePushForUser(uid).catch(() => {})
  }

  function dismissPushPrompt() {
    setShowPushPrompt(false)
  }

  useEffect(() => {
    if (!uid) return undefined
    updateDoc(doc(db, 'profiles', uid), { lastActive: serverTimestamp() }).catch(() => {})
    const heartbeat = setInterval(() => {
      updateDoc(doc(db, 'profiles', uid), { lastActive: serverTimestamp() }).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(heartbeat)
  }, [uid])

  useEffect(() => {
    if (!uid) {
      setMatches([])
      return
    }
    isFirstMatchesSnapshot.current = true
    const q = query(collection(db, 'matches'), where('users', 'array-contains', uid))
    const unsubscribe = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

      if (!isFirstMatchesSnapshot.current) {
        for (const match of next) {
          const wasSeen = prevSeenRef.current[match.id]
          const nowSeen = match.seen?.[uid]
          if (wasSeen === true && nowSeen === false) {
            playNotificationSound()
          }
        }
      }
      isFirstMatchesSnapshot.current = false
      prevSeenRef.current = Object.fromEntries(next.map((m) => [m.id, m.seen?.[uid]]))

      setMatches(next)
    })
    return unsubscribe
  }, [uid])

  // Keyed on the *set* of matched partner ids, not on `matches` itself —
  // `matches` gets a new array reference on every match-doc write (new
  // message, typing ping, read receipt, seen flag), which would otherwise
  // tear down and re-subscribe every profile listener on each of those,
  // re-reading every matched profile from Firestore for no reason.
  const matchedOtherUidsKey = useMemo(() => {
    if (!uid) return ''
    return [...new Set(matches.map((m) => m.users.find((u) => u !== uid)).filter(Boolean))].sort().join(',')
  }, [matches, uid])

  useEffect(() => {
    if (!uid || !matchedOtherUidsKey) return
    const otherUids = matchedOtherUidsKey.split(',')
    const unsubscribes = otherUids.map((otherUid) =>
      onSnapshot(doc(db, 'profiles', otherUid), (snap) => {
        setProfilesById((prev) => ({ ...prev, [otherUid]: snap.exists() ? snap.data() : null }))
      }),
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [uid, matchedOtherUidsKey])

  useEffect(() => {
    if (!openMatchId) return
    const q = query(collection(db, 'matches', openMatchId, 'messages'), orderBy('createdAt', 'asc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setActiveMessages((prev) => ({
        ...prev,
        [openMatchId]: snap.docs.map((d) => {
          const data = d.data()
          const date = data.createdAt?.toDate?.() ?? new Date()
          return {
            id: d.id,
            senderId: data.senderId,
            fromMe: data.senderId === uid,
            text: data.text,
            type: data.type || 'text',
            audioUrl: data.audioUrl || null,
            duration: data.duration || 0,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
            fileSize: data.fileSize || 0,
            time: formatTime(date),
            date,
            edited: !!data.editedAt,
            pending: d.metadata.hasPendingWrites,
            replyTo: data.replyTo || null,
          }
        }),
      }))
    })
    return unsubscribe
  }, [openMatchId, uid])

  const conversations = useMemo(() => {
    return matches
      .map((match) => {
        const otherUid = match.users.find((u) => u !== uid)
        if (blockedIds.has(otherUid)) return null
        const profile = profilesById[otherUid]
        if (!profile) return null
        const otherLastReadAt = match.lastReadAt?.[otherUid]?.toMillis?.() ?? null
        const messages = (activeMessages[match.id] || []).map((m) => {
          if (!m.fromMe) return m
          const status = m.pending ? 'sending' : otherLastReadAt && m.date.getTime() <= otherLastReadAt ? 'read' : 'sent'
          return { ...m, status }
        })
        const matchedAt = match.createdAt?.toDate ? match.createdAt.toDate().toISOString() : new Date().toISOString()
        const lastActivityAt = match.lastMessageAt?.toDate ? match.lastMessageAt.toDate().toISOString() : matchedAt
        const online = isRecent(profile.lastActive, ONLINE_THRESHOLD_MS, now)
        return {
          id: match.id,
          otherUid,
          profile: {
            firstName: profile.firstName,
            age: profile.age,
            city: profile.city,
            interests: profile.interests || [],
            photo:
              photoVariant(profile.photos?.[0], 'thumb') ||
              `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || 'Bomavibes')}&backgroundColor=e8c468`,
            photoMedium:
              photoVariant(profile.photos?.[0], 'medium') ||
              `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || 'Bomavibes')}&backgroundColor=e8c468`,
            photoFull:
              profile.photos?.[0] ||
              `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || 'Bomavibes')}&backgroundColor=e8c468`,
          },
          matchedAt,
          lastActivityAt,
          isNewMatch: match.seen?.[uid] === false,
          unreadCount: match.seen?.[uid] === false ? 1 : 0,
          lastMessage: match.lastMessage || null,
          messages,
          online,
          lastSeenLabel: online ? 'En ligne' : formatLastSeen(profile.lastActive, now),
          isTyping: isRecent(match.typing?.[otherUid], TYPING_THRESHOLD_MS, now),
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
  }, [matches, profilesById, activeMessages, uid, now, blockedIds])

  const typingId = conversations.find((c) => c.isTyping)?.id ?? null
  const newMatchesCount = useMemo(() => conversations.filter((c) => c.isNewMatch).length, [conversations])
  const unreadMessagesCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  )

  async function openConversation(id) {
    setOpenMatchId(id)
    const match = matches.find((m) => m.id === id)
    const updates = { [`lastReadAt.${uid}`]: serverTimestamp() }
    if (match?.seen?.[uid] === false) updates[`seen.${uid}`] = true
    await updateDoc(doc(db, 'matches', id), updates).catch(() => {})
  }

  // openMatchId lives here (above the router), so it survives route changes —
  // without this, the messages listener for the last-viewed conversation
  // would keep reading every new message in it even after leaving the Chat
  // page entirely. Call this on Chat page unmount.
  function closeConversation() {
    setOpenMatchId(null)
  }

  async function markMatchesSeen() {
    await Promise.all(
      matches
        .filter((m) => m.seen?.[uid] === false)
        .map((m) => updateDoc(doc(db, 'matches', m.id), { [`seen.${uid}`]: true })),
    )
  }

  async function sendMessage(matchId, text, replyTo) {
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      senderId: uid,
      text,
      createdAt: serverTimestamp(),
      ...(replyTo
        ? {
            replyTo: {
              messageId: replyTo.id,
              text: messagePreviewText(replyTo),
              senderId: replyTo.senderId,
            },
          }
        : {}),
    })
    const match = matches.find((m) => m.id === matchId)
    const otherUid = match?.users.find((u) => u !== uid)
    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      ...(otherUid ? { [`seen.${otherUid}`]: false } : {}),
    })

    if (otherUid) {
      sendPushNotification(otherUid, 'message', { firstName: user?.firstName, text })
    }
  }

  async function sendVoiceMessage(matchId, audioUrl, duration) {
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      senderId: uid,
      text: '',
      type: 'voice',
      audioUrl,
      duration,
      createdAt: serverTimestamp(),
    })
    const match = matches.find((m) => m.id === matchId)
    const otherUid = match?.users.find((u) => u !== uid)
    const preview = '🎤 Message vocal'
    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: preview,
      lastMessageAt: serverTimestamp(),
      ...(otherUid ? { [`seen.${otherUid}`]: false } : {}),
    })

    if (otherUid) {
      sendPushNotification(otherUid, 'message', { firstName: user?.firstName, text: preview })
    }
  }

  async function sendAttachmentMessage(matchId, attachment) {
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      senderId: uid,
      text: '',
      type: attachment.type,
      fileUrl: attachment.url,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize || 0,
      createdAt: serverTimestamp(),
    })
    const match = matches.find((m) => m.id === matchId)
    const otherUid = match?.users.find((u) => u !== uid)
    const preview = messagePreviewText({ type: attachment.type, fileName: attachment.fileName })
    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: preview,
      lastMessageAt: serverTimestamp(),
      ...(otherUid ? { [`seen.${otherUid}`]: false } : {}),
    })

    if (otherUid) {
      sendPushNotification(otherUid, 'message', { firstName: user?.firstName, text: preview })
    }
  }

  async function editMessage(matchId, messageId, text) {
    await updateDoc(doc(db, 'matches', matchId, 'messages', messageId), {
      text,
      editedAt: serverTimestamp(),
    })
  }

  async function deleteMessage(matchId, messageId) {
    await deleteDoc(doc(db, 'matches', matchId, 'messages', messageId))
  }

  async function setTyping(matchId, isTyping) {
    await updateDoc(doc(db, 'matches', matchId), {
      [`typing.${uid}`]: isTyping ? serverTimestamp() : null,
    }).catch(() => {})
  }

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        typingId,
        setTyping,
        unreadMessagesCount,
        newMatchesCount,
        openConversation,
        closeConversation,
        markMatchesSeen,
        sendMessage,
        sendVoiceMessage,
        sendAttachmentMessage,
        editMessage,
        deleteMessage,
        showPushPrompt,
        acceptPushPrompt,
        dismissPushPrompt,
        refreshBlockedIds,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  )
}

export function useConversations() {
  const ctx = useContext(ConversationsContext)
  if (!ctx) throw new Error('useConversations must be used within a ConversationsProvider')
  return ctx
}
