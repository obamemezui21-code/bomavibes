import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
import { useAuth } from './AuthContext.jsx'

const ConversationsContext = createContext(null)

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ConversationsProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.id
  const [matches, setMatches] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [activeMessages, setActiveMessages] = useState({})
  const [openMatchId, setOpenMatchId] = useState(null)

  useEffect(() => {
    if (!uid) {
      setMatches([])
      return
    }
    const q = query(collection(db, 'matches'), where('users', 'array-contains', uid))
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.matchedAt) - new Date(a.matchedAt))
  }, [matches, profilesById, activeMessages, uid])

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

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        typingId: null,
        unreadMessagesCount,
        newMatchesCount,
        openConversation,
        markMatchesSeen,
        sendMessage,
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
