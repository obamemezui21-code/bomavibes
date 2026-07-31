import { createContext, useContext, useMemo, useState } from 'react'
import { mockConversations } from '../data/mockConversations.js'

const ConversationsContext = createContext(null)

const CANNED_REPLIES = [
  'Haha carrément 😄',
  'Ah oui je vois ce que tu veux dire',
  'On se capte bientôt pour en discuter en vrai ?',
  "J'adore, raconte-moi en plus !",
  'Trop bien, ça me va parfaitement 🙌',
]

function formatTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ConversationsProvider({ children }) {
  const [conversations, setConversations] = useState(mockConversations)
  const [typingId, setTypingId] = useState(null)

  const unreadMessagesCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  )
  const newMatchesCount = useMemo(
    () => conversations.filter((c) => c.isNewMatch).length,
    [conversations],
  )

  function openConversation(id) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  function markMatchesSeen() {
    setConversations((prev) => prev.map((c) => ({ ...c, isNewMatch: false })))
  }

  function sendMessage(conversationId, text) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, { id: Date.now(), fromMe: true, text, time: formatTime() }] }
          : c,
      ),
    )

    setTypingId(conversationId)
    const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]
    setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, { id: Date.now() + 1, fromMe: false, text: reply, time: formatTime() }],
              }
            : c,
        ),
      )
      setTypingId(null)
    }, 1400)
  }

  function addMatch(profile) {
    const id = `p${profile.id}`
    setConversations((prev) => {
      if (prev.some((c) => c.id === id)) return prev
      return [
        {
          id,
          profile: { firstName: profile.firstName, city: profile.city, photo: profile.photos?.[0] || profile.photo },
          matchedAt: new Date().toISOString(),
          online: Math.random() > 0.5,
          isNewMatch: true,
          unreadCount: 0,
          messages: [],
        },
        ...prev,
      ]
    })
    return id
  }

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        typingId,
        unreadMessagesCount,
        newMatchesCount,
        openConversation,
        markMatchesSeen,
        sendMessage,
        addMatch,
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
