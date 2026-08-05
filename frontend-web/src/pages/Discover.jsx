import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MapPin, Megaphone, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import FilterSheet from '../components/FilterSheet.jsx'
import Confetti from '../components/Confetti.jsx'
import { fetchDiscoverCandidates } from '../firebase/discovery.js'
import { recordSwipeAndMatch } from '../firebase/swipes.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { INTEREST_ICONS, matchPercent } from '../lib/interests.js'

const INTERESTS = Object.keys(INTEREST_ICONS)

const NEW_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000
const DEFAULT_FILTERS = { minAge: 18, maxAge: 60, gender: 'TOUS' }

function isNew(profile) {
  const createdAt = profile.createdAt?.toDate?.()
  return !!createdAt && Date.now() - createdAt.getTime() < NEW_THRESHOLD_MS
}

function avatarFor(profile) {
  return (
    profile.photos?.[0] ||
    `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`
  )
}

function Discover() {
  const { user, publicProfile, hasUnseenAnnouncement, latestAnnouncement, markAnnouncementsSeen } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [profiles, setProfiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedProfile, setExpandedProfile] = useState(null)
  const [selectedInterest, setSelectedInterest] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [matchedProfile, setMatchedProfile] = useState(null)
  const [matchConversationId, setMatchConversationId] = useState(null)

  async function loadCandidates(currentFilters) {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const candidates = await fetchDiscoverCandidates(user.id, currentFilters)
      setProfiles(candidates)
    } catch {
      showToast('Impossible de charger les profils, réessayez.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const searched = useMemo(() => {
    if (!search.trim()) return profiles
    const q = search.trim().toLowerCase()
    return profiles.filter((p) => p.firstName?.toLowerCase().includes(q))
  }, [profiles, search])

  const newPeople = useMemo(
    () => [...searched].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 10),
    [searched],
  )

  const aroundMe = useMemo(
    () => (selectedInterest ? searched.filter((p) => p.interests?.includes(selectedInterest)) : searched),
    [searched, selectedInterest],
  )

async function handleSwipe(profile, direction) {
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    try {
      const matchId = await recordSwipeAndMatch(user.id, profile.id, direction, user.firstName)
      if (matchId) {
        setMatchConversationId(matchId)
        setMatchedProfile(profile)
      } else if (direction !== 'pass') {
        showToast(`Vous avez aimé le profil de ${profile.firstName}.`, 'success')
      }
    } catch {
      showToast("Impossible d'enregistrer votre choix, réessayez.", 'error')
    }
  }

  function handleLike(profile) {
    return handleSwipe(profile, 'like')
  }

  function handleSuperlike(profile) {
    return handleSwipe(profile, 'superlike')
  }

  function handlePass(profile) {
    return handleSwipe(profile, 'pass')
  }

  function handleCloseFilters() {
    setShowFilters(false)
    loadCandidates(filters)
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-surface-soft px-4 pb-10 pt-6 sm:px-6 md:min-h-full">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-ink-soft/60">
                <MapPin size={13} strokeWidth={2.25} />
                {publicProfile?.country || 'Autour de vous'}
              </div>
              <h1 className="font-display text-2xl font-semibold text-ink">
                Salut {user?.firstName} 👋
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  showSearch
                    ? 'border-violet-400/60 bg-violet-500/10 text-violet-600'
                    : 'border-ink/12 bg-ink/[0.03] text-ink/80 hover:border-violet-400/60 hover:text-violet-600'
                }`}
                aria-label="Rechercher"
              >
                <Search size={17} />
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.03] text-ink/80 transition hover:border-violet-400/60 hover:text-violet-600"
                aria-label="Filtres"
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {hasUnseenAnnouncement && latestAnnouncement && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 overflow-hidden"
              >
                <div className="flex items-start gap-3 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/10 to-pink-500/10 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600">
                    <Megaphone size={16} strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{latestAnnouncement.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft/70">{latestAnnouncement.description}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/annonces')}
                      className="mt-2 text-xs font-semibold text-violet-600 underline-offset-2 hover:underline"
                    >
                      En savoir plus →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={markAnnouncementsSeen}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft/50 transition hover:bg-ink/5"
                    aria-label="Fermer"
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher un prénom…"
                  className="mt-3 w-full rounded-xl border border-ink/12 bg-white dark:bg-surface-tint px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : searched.length === 0 ? (
          <div className="glass-panel flex flex-col items-center gap-2 rounded-[28px] p-10 text-center">
            <Sparkles size={40} strokeWidth={1.5} className="text-violet-500" />
            <p className="font-display text-lg font-semibold text-ink">Aucun profil pour le moment</p>
            <p className="max-w-xs text-sm text-ink-soft/70">
              Élargissez vos filtres ou revenez plus tard pour voir plus de monde.
            </p>
          </div>
        ) : (
          <>
            {newPeople.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Nouveaux profils</h2>
                <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {newPeople.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExpandedProfile(p)}
                      className="relative h-44 w-32 shrink-0 overflow-hidden rounded-2xl text-left shadow-sm"
                    >
                      <img src={avatarFor(p)} alt={p.firstName} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                      {isNew(p) && (
                        <span className="absolute left-2 top-2 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Nouveau
                        </span>
                      )}
                      <div className="absolute inset-x-2 bottom-2 text-white">
                        <p className="text-sm font-semibold">
                          {p.firstName}, {p.age}
                        </p>
                        {p.city && <p className="text-[11px] text-white/75">{p.city}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Centres d'intérêt</h2>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
                {INTERESTS.map((interest) => {
                  const Icon = INTEREST_ICONS[interest]
                  const active = selectedInterest === interest
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => setSelectedInterest(active ? null : interest)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition ${
                        active
                          ? 'border-violet-400 bg-violet-500/10 text-violet-600'
                          : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
                      }`}
                    >
                      <Icon size={14} strokeWidth={2} />
                      {interest}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Autour de vous</h2>
              <p className="text-xs text-ink-soft/60">
                {selectedInterest
                  ? `Profils qui aiment "${selectedInterest}" près de vous`
                  : 'Des profils près de chez vous'}
              </p>

              <div className="relative mt-3 h-52 overflow-hidden rounded-[28px] bg-gradient-to-br from-mint-500/15 via-surface-soft to-violet-500/15">
                <svg className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none" viewBox="0 0 300 200">
                  <path d="M0 40 Q 90 10 150 60 T 300 50" stroke="currentColor" strokeWidth="2" fill="none" className="text-ink/15" />
                  <path d="M0 150 Q 100 190 180 140 T 300 160" stroke="currentColor" strokeWidth="2" fill="none" className="text-ink/15" />
                  <circle cx="60" cy="100" r="2.5" className="fill-ink/15" />
                  <circle cx="220" cy="70" r="2.5" className="fill-ink/15" />
                  <circle cx="250" cy="150" r="2.5" className="fill-ink/15" />
                </svg>

                {aroundMe.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft/50">
                    Personne à afficher pour le moment
                  </div>
                ) : (
                  aroundMe.slice(0, 2).map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExpandedProfile(p)}
                      className={`absolute flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-3 shadow-lg backdrop-blur transition hover:scale-105 dark:bg-surface-tint/95 ${
                        i === 0 ? 'left-5 top-6' : 'right-5 bottom-6'
                      }`}
                    >
                      <img src={avatarFor(p)} alt={p.firstName} className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-400" />
                      <span className="text-xs font-semibold text-ink">Rencontrer {p.firstName}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {expandedProfile && (
          <ProfileDetailModal
            profile={expandedProfile}
            matchPercent={matchPercent(publicProfile?.interests, expandedProfile.interests)}
            onClose={() => setExpandedProfile(null)}
            onLike={() => handleLike(expandedProfile)}
            onSuperlike={() => handleSuperlike(expandedProfile)}
            onPass={() => handlePass(expandedProfile)}
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
                Vous et {matchedProfile.firstName} vous êtes plu mutuellement.
              </p>

              <div className="relative mt-6 flex items-center justify-center">
                <motion.img
                  initial={{ x: -30, rotate: -8, opacity: 0 }}
                  animate={{ x: -14, rotate: -6, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src={avatarFor(matchedProfile)}
                  alt={matchedProfile.firstName}
                  className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 400 }}
                  className="z-10 -mx-3 flex h-9 w-9 items-center justify-center rounded-full bg-coral-500 text-white shadow-lg"
                >
                  <Heart size={18} strokeWidth={2.5} fill="currentColor" />
                </motion.div>
                <motion.img
                  initial={{ x: 30, rotate: 8, opacity: 0 }}
                  animate={{ x: 14, rotate: 6, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src="https://api.dicebear.com/9.x/personas/svg?seed=You&backgroundColor=8b5cf6"
                  alt="Vous"
                  className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
                />
              </div>

              <div className="relative mt-8 flex flex-col gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/chat/${matchConversationId}`)}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25"
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
