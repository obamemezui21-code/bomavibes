import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
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
import { playNotificationSound } from '../lib/notificationSound.js'
import { useAuth } from './AuthContext.jsx'

const ConversationsContext = createContext(null)
const ONLINE_THRESHOLD_MS = 90 * 1000
const TYPING_THRESHOLD_MS = 6 * 1000
const HEARTBEAT_INTERVAL_MS = 45 * 1000

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isRecent(timestamp, thresholdMs, now) {
  const ms = timestamp?.toMillis?.()
  return !!ms && now - ms < thresholdMs
}

export function ConversationsProvider({ children }) {
  const { user, profile } = useAuth()
  const uid = user?.id
  const [matches, setMatches] = useState([])
  const [profilesById, setProfilesById] = useState({})
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

  useEffect(() => {
    if (!uid) return
    const otherUids = [...new Set(matches.map((m) => m.users.find((u) => u !== uid)).filter(Boolean))]
    const unsubscribes = otherUids.map((otherUid) =>
      onSnapshot(doc(db, 'profiles', otherUid), (snap) => {
        setProfilesById((prev) => ({ ...prev, [otherUid]: snap.exists() ? snap.data() : null }))
      }),
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [uid, matches])

  useEffect(() => {
    if (!openMatchId) return
    const q = query(collection(db, 'matches', openMatchId, 'messages'), orderBy('createdAt', 'asc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setActiveMessages((prev) => ({
        ...prev,
        [openMatchId]: snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            fromMe: data.senderId === uid,
            text: data.text,
            time: formatTime(data.createdAt?.toDate?.()),
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
        const profile = profilesById[otherUid]
        if (!profile) return null
        return {
          id: match.id,
          profile: {
            firstName: profile.firstName,
            age: profile.age,
            city: profile.city,
            interests: profile.interests || [],
            photo:
              profile.photos?.[0] ||
              `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || 'Bomavibes')}&backgroundColor=e8c468`,
          },
          matchedAt: match.createdAt?.toDate ? match.createdAt.toDate().toISOString() : new Date().toISOString(),
          isNewMatch: match.seen?.[uid] === false,
          unreadCount: match.seen?.[uid] === false ? 1 : 0,
          lastMessage: match.lastMessage || null,
          messages: activeMessages[match.id] || [],
          online: isRecent(profile.lastActive, ONLINE_THRESHOLD_MS, now),
          isTyping: isRecent(match.typing?.[otherUid], TYPING_THRESHOLD_MS, now),
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.matchedAt) - new Date(a.matchedAt))
  }, [matches, profilesById, activeMessages, uid, now])

  const typingId = conversations.find((c) => c.isTyping)?.id ?? null
  const newMatchesCount = useMemo(() => conversations.filter((c) => c.isNewMatch).length, [conversations])
  const unreadMessagesCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  )

  async function openConversation(id) {
    setOpenMatchId(id)
    const match = matches.find((m) => m.id === id)
    if (match && match.seen?.[uid] === false) {
      await updateDoc(doc(db, 'matches', id), { [`seen.${uid}`]: true })
    }
  }

  async function markMatchesSeen() {
    await Promise.all(
      matches
        .filter((m) => m.seen?.[uid] === false)
        .map((m) => updateDoc(doc(db, 'matches', m.id), { [`seen.${uid}`]: true })),
    )
  }

  async function sendMessage(matchId, text) {
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      senderId: uid,
      text,
      createdAt: serverTimestamp(),
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
        markMatchesSeen,
        sendMessage,
        showPushPrompt,
        acceptPushPrompt,
        dismissPushPrompt,
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
