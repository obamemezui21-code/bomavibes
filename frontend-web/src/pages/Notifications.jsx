import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowLeft, BellRing, CalendarDays, CheckCheck, Heart, MessageCircle } from 'lucide-react'
import { db } from '../firebase/config.js'
import { useConversations } from '../context/ConversationsContext.jsx'
import { messagePreviewText } from '../lib/messagePreview.js'

function timeAgo(iso) {
  if (!iso) return ''
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `Il y a ${diffHour} h`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `Il y a ${diffDay} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const ICONS = { match: Heart, message: MessageCircle, announcement: CalendarDays }

function useNotificationItems() {
  const { conversations } = useConversations()
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setAnnouncements(
        snap.docs.slice(0, 10).map((d) => {
          const data = d.data()
          const date = data.createdAt?.toDate?.() ?? null
          return {
            id: `announcement-${d.id}`,
            kind: 'announcement',
            title: data.title || 'Annonce BomaVibes',
            body: data.body || '',
            at: date ? date.toISOString() : new Date().toISOString(),
            read: true,
            to: '/annonces',
          }
        }),
      )
    })
    return unsubscribe
  }, [])

  const matchAndMessageItems = conversations.map((c) => {
    const isMessage = !!c.lastMessage
    return {
      id: c.id,
      kind: isMessage ? 'message' : 'match',
      title: isMessage ? `${c.profile.firstName} vous a écrit` : `Nouveau match avec ${c.profile.firstName}`,
      body: isMessage ? messagePreviewText(c.lastMessage) : 'Vous vous êtes plu mutuellement — lancez la conversation !',
      at: c.lastActivityAt,
      read: !c.isNewMatch && c.unreadCount === 0,
      to: `/chat/${c.id}`,
    }
  })

  return [...matchAndMessageItems, ...announcements].sort((a, b) => new Date(b.at) - new Date(a.at))
}

function Notifications() {
  const navigate = useNavigate()
  const { markMatchesSeen } = useConversations()
  const items = useNotificationItems()

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Notifications</h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={markMatchesSeen}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-violet-500"
          >
            <CheckCheck size={15} /> Tout marquer lu
          </button>
        )}
      </div>

      <div className="mx-auto max-w-2xl space-y-2 px-4 pt-5">
        {items.length === 0 ? (
          <div className="glass-panel-solid rounded-3xl p-8 text-center">
            <BellRing size={26} strokeWidth={1.5} className="mx-auto mb-2 text-violet-500" />
            <p className="text-sm text-ink-soft">
              Aucune notification pour l'instant. Vos nouveaux matchs et messages arriveront ici.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const Icon = ICONS[item.kind]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.to)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:bg-ink/[0.03] ${
                  item.read ? 'border-ink/8 bg-surface' : 'border-pink-400/40 bg-surface'
                }`}
              >
                <Icon size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-pink-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{item.title}</div>
                  {item.body && <div className="mt-0.5 truncate text-xs text-ink-soft">{item.body}</div>}
                  <div className="mt-1 text-[10px] text-ink-soft/70">{timeAgo(item.at)}</div>
                </div>
                {!item.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-pink-500" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Notifications
