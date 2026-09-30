import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { db } from '../firebase/config.js'
import { useAuth } from '../context/AuthContext.jsx'
import AnnouncementCard from '../components/AnnouncementCard.jsx'

function Announcements() {
  const navigate = useNavigate()
  const { markAnnouncementsSeen } = useAuth()
  const [announcements, setAnnouncements] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setAnnouncements(
        snap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, ...data, date: data.createdAt?.toDate?.() ?? null }
        }),
      )
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    markAnnouncementsSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isLoading = announcements === null

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
        <h1 className="font-display text-lg font-semibold text-ink">Annonces</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Sparkles size={32} strokeWidth={1.5} className="text-ink-soft/40" />
            <p className="text-sm text-ink-soft/60">Rien de nouveau pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <AnnouncementCard announcement={a} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Announcements
