import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SwipeCard from '../components/SwipeCard.jsx'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import FilterSheet from '../components/FilterSheet.jsx'
import Confetti from '../components/Confetti.jsx'
import { mockProfiles } from '../data/mockProfiles.js'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const ACTIONS = [
  { direction: 'pass', icon: '✕', label: 'Passer', className: 'h-14 w-14 text-2xl text-coral-500' },
  { direction: 'superlike', icon: '★', label: 'Super like', className: 'h-11 w-11 text-lg text-violet-600' },
  { direction: 'like', icon: '♥', label: 'Aimer', className: 'h-14 w-14 text-2xl text-mint-500' },
]

const DEFAULT_FILTERS = { minAge: 18, maxAge: 60, maxDistance: 50, gender: 'TOUS' }

function matchesFilters(profile, filters) {
  if (profile.age < filters.minAge || profile.age > filters.maxAge) return false
  if (profile.distanceKm > filters.maxDistance) return false
  if (filters.gender !== 'TOUS' && profile.gender !== filters.gender) return false
  return true
}

function Discover() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [profiles, setProfiles] = useState(() => mockProfiles.filter((p) => matchesFilters(p, DEFAULT_FILTERS)))
  const [history, setHistory] = useState([])
  const [matchedProfile, setMatchedProfile] = useState(null)
  const [matchConversationId, setMatchConversationId] = useState(null)
  const [expandedProfile, setExpandedProfile] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const topCardRef = useRef(null)
  const navigate = useNavigate()
  const { addMatch } = useConversations()
  const { showToast } = useToast()

  const visible = profiles.slice(0, 3)

  function handleExit(profile, direction) {
    setHistory((h) => [...h, { profile, direction }])
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    if ((direction === 'like' || direction === 'superlike') && profile.likesBack) {
      const id = addMatch(profile)
      setMatchConversationId(id)
      setMatchedProfile(profile)
    }
  }

  function handleAction(direction) {
    topCardRef.current?.fly(direction)
  }

  function handleRewind() {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setProfiles((prev) => [last.profile, ...prev])
  }

  function handleReload() {
    setProfiles(mockProfiles.filter((p) => matchesFilters(p, filters)))
    setHistory([])
  }

  function handleCloseFilters() {
    setShowFilters(false)
    setProfiles(mockProfiles.filter((p) => matchesFilters(p, filters)))
    setHistory([])
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  function handleReport(profile) {
    showToast(`${profile.firstName} a été signalé(e). Merci de nous aider à garder BomaVibes sûr.`, 'success')
  }

  function handleBlock(profile) {
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    showToast(`${profile.firstName} a été bloqué(e).`, 'info')
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center gap-6 overflow-hidden bg-surface-soft p-6 md:min-h-full">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 flex w-full max-w-sm items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Découvrir</h1>
          <p className="text-xs text-ink-soft/60">
            {profiles.length > 0
              ? `${profiles.length} profil${profiles.length > 1 ? 's' : ''} près de toi`
              : 'Aucun profil restant'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.03] text-base text-ink/80 transition hover:border-violet-400/60 hover:text-violet-600"
            aria-label="Filtres"
            title="Filtres"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={handleRewind}
            disabled={history.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.03] text-lg text-ink/80 transition hover:border-violet-400/60 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Revenir en arrière"
            title="Revenir en arrière"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="relative z-10 h-[540px] w-full max-w-sm">
        {visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel flex h-full flex-col items-center justify-center gap-3 rounded-[28px] text-center"
          >
            <span className="text-5xl">🎉</span>
            <p className="font-display text-lg font-semibold text-ink">
              Plus de profils pour le moment
            </p>
            <p className="max-w-xs text-sm text-ink-soft/70">
              Reviens plus tard, ou élargis tes filtres pour voir plus de monde.
            </p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleReload}
              className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
            >
              Recharger la liste
            </motion.button>
          </motion.div>
        ) : (
          visible.map((profile, i) => (
            <div
              key={profile.id}
              className="absolute inset-0"
              style={{
                zIndex: visible.length - i,
                transform: `scale(${1 - i * 0.045}) translateY(${i * 14}px)`,
                transition: 'transform 300ms ease',
              }}
            >
              <SwipeCard
                ref={i === 0 ? topCardRef : undefined}
                profile={profile}
                active={i === 0}
                onExit={(direction) => handleExit(profile, direction)}
                onExpand={setExpandedProfile}
                onReport={handleReport}
                onBlock={handleBlock}
              />
            </div>
          ))
        )}
      </div>

      {visible.length > 0 && (
        <div className="relative z-10 flex items-center gap-5">
          {ACTIONS.map((action) => (
            <motion.button
              key={action.direction}
              type="button"
              whileTap={{ scale: 0.85 }}
              whileHover={{ y: -3 }}
              onClick={() => handleAction(action.direction)}
              aria-label={action.label}
              className={`flex items-center justify-center rounded-full bg-white shadow-lg transition ${action.className}`}
            >
              {action.icon}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {expandedProfile && (
          <ProfileDetailModal
            profile={expandedProfile}
            onClose={() => setExpandedProfile(null)}
            onLike={() => handleAction('like')}
            onPass={() => handleAction('pass')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && (
          <FilterSheet
            filters={filters}
            onChange={setFilters}
            onClose={handleCloseFilters}
            onReset={handleResetFilters}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {matchedProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="glass-panel relative w-full max-w-sm overflow-hidden rounded-[28px] p-8 text-center"
            >
              <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-pink-400/25 blur-[60px]" />
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-coral-500/20 blur-[60px]" />
              <Confetti />

              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 260 }}
                className="relative font-display text-3xl font-bold text-gradient-brand"
              >
                C'est un match !
              </motion.p>
              <p className="relative mt-2 text-sm text-ink-soft/80">
                Toi et {matchedProfile.firstName} vous êtes plu mutuellement.
              </p>

              <div className="relative mt-6 flex items-center justify-center">
                <motion.img
                  initial={{ x: -30, rotate: -8, opacity: 0 }}
                  animate={{ x: -14, rotate: -6, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src={matchedProfile.photo}
                  alt={matchedProfile.firstName}
                  className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 400 }}
                  className="z-10 -mx-3 flex h-9 w-9 items-center justify-center rounded-full bg-coral-500 text-lg text-white shadow-lg"
                >
                  ♥
                </motion.div>
                <motion.img
                  initial={{ x: 30, rotate: 8, opacity: 0 }}
                  animate={{ x: 14, rotate: 6, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src="https://api.dicebear.com/9.x/adventurer/svg?seed=You&backgroundColor=8b5cf6"
                  alt="Toi"
                  className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
                />
              </div>

              <div className="relative mt-8 flex flex-col gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/chat/${matchConversationId}`)}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
                >
                  Envoyer un message
                </motion.button>
                <button
                  type="button"
                  onClick={() => setMatchedProfile(null)}
                  className="rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
                >
                  Continuer à découvrir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Discover
