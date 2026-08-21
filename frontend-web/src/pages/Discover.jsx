import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Check,
  Globe2,
  Heart,
  MapPin,
  Megaphone,
  MessageCircle,
  Plane,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import SwipeCard from '../components/SwipeCard.jsx'
import FilterSheet from '../components/FilterSheet.jsx'
import Confetti from '../components/Confetti.jsx'
import SupportPromptCard from '../components/SupportPromptCard.jsx'
import { TIERS } from '../components/PricingTiers.jsx'
import { fetchDiscoverCandidates } from '../firebase/discovery.js'
import { recordSwipeAndMatch } from '../firebase/swipes.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { matchPercent } from '../lib/interests.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { CONTINENT_ORDER, COUNTRIES } from '../lib/geography.js'
import { RELIGIONS } from '../lib/onboardingOptions.js'

const DEFAULT_FILTERS = { minAge: 18, maxAge: 60, gender: 'TOUS' }
const DECK_SIZE = 5
const NEARBY_CHIP = 'À proximité'
const GOAL_CHIPS = [NEARBY_CHIP, 'Relation sérieuse', 'Amitié', 'Sortie', 'Discussion']

function avatarFor(profile) {
  return (
    photoVariant(profile.photos?.[0], 'thumb') ||
    `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(profile.firstName || profile.id)}&backgroundColor=f3e8ff,fce7f3,ede9fe`
  )
}

function fullPhotoFor(profile) {
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
  const [search, setSearch] = useState('')
  const [activeChip, setActiveChip] = useState(null)
  const [countryFilter, setCountryFilter] = useState('')
  const [religionFilter, setReligionFilter] = useState('')
  const [travelingOnly, setTravelingOnly] = useState(false)
  const [matchedProfile, setMatchedProfile] = useState(null)
  const [matchConversationId, setMatchConversationId] = useState(null)
  const [exitingId, setExitingId] = useState(null)
  const [exitDirection, setExitDirection] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const seenIdsRef = useRef(new Set())

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  async function loadCandidates(currentFilters, { includeRefused = false } = {}) {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const candidates = await fetchDiscoverCandidates(user.id, currentFilters, {
        seenIds: seenIdsRef.current,
        includeRefused,
        myInterests: publicProfile?.interests || [],
      })
      setProfiles(candidates)
    } catch {
      showToast('Impossible de charger les profils, réessayez.', 'error')
    } finally {
      setIsLoading(false)
      setIsReviewing(false)
    }
  }

  useEffect(() => {
    loadCandidates(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const searched = useMemo(() => {
    let list = profiles
    if (activeChip === NEARBY_CHIP) {
      if (publicProfile?.city) list = list.filter((p) => p.city === publicProfile.city)
    } else if (activeChip) {
      list = list.filter((p) => p.datingGoal === activeChip)
    }
    if (countryFilter) list = list.filter((p) => p.country === countryFilter)
    if (religionFilter) list = list.filter((p) => p.religion === religionFilter)
    if (travelingOnly) list = list.filter((p) => p.isTraveling)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.firstName?.toLowerCase().includes(q))
    }
    return list
  }, [profiles, search, activeChip, countryFilter, religionFilter, travelingOnly, publicProfile])

  const deck = searched.slice(0, DECK_SIZE)
  const topProfile = deck[0] || null

  useEffect(() => {
    if (topProfile?.id) seenIdsRef.current.add(topProfile.id)
  }, [topProfile?.id])

  function handleReviewProfiles() {
    setIsReviewing(true)
    loadCandidates(filters, { includeRefused: true })
  }

  async function handleInviteFriends() {
    const shareData = {
      title: 'BomaVibes',
      text: 'Rejoins-moi sur BomaVibes, la rencontre africaine 💛',
      url: 'https://bomavibes.tech',
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // user cancelled the native share sheet, nothing to do
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
      showToast('Lien copié, à toi de le partager !', 'success')
    } catch {
      showToast('Impossible de copier le lien.', 'error')
    }
  }

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

  function triggerSwipe(profile, direction) {
    if (exitingId) return
    setExitDirection(direction)
    setExitingId(profile.id)
  }

  function handleExited(profile, direction) {
    setExitingId(null)
    setExitDirection(null)
    handleSwipe(profile, direction)
  }

  function handleLike(profile) {
    return triggerSwipe(profile, 'like')
  }

  function handleSuperlike(profile) {
    return triggerSwipe(profile, 'superlike')
  }

  function handlePass(profile) {
    return triggerSwipe(profile, 'pass')
  }

  function handleBlocked(profile) {
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
  }

  function handleCloseFilters() {
    setShowFilters(false)
    loadCandidates(filters)
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  return (
    <div className="relative min-h-svh bg-surface-soft desktop:min-h-full">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-violet-500/10 blur-[100px]" />

      {/* Sticky nav — solid at the very top, fades into a blurred glass bar once scrolled */}
      <div
        className={`sticky top-0 z-30 px-4 pt-6 transition-colors duration-300 sm:px-6 ${
          isScrolled ? 'bg-surface-soft/70 backdrop-blur-xl' : 'bg-surface-soft'
        }`}
      >
        <div className="relative z-10 mx-auto w-full max-w-xl pb-3">
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
            <button
              type="button"
              onClick={() => navigate('/annonces')}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.03] text-ink/80 transition hover:border-violet-400/60 hover:text-violet-600"
              aria-label="Annonces"
            >
              <Bell size={17} />
              {hasUnseenAnnouncement && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral-500" />
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher des gens…"
                className="w-full rounded-full border border-ink/12 bg-white dark:bg-surface-tint py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.03] text-ink/80 transition hover:border-violet-400/60 hover:text-violet-600"
              aria-label="Filtres"
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveChip(null)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                !activeChip
                  ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-md shadow-violet-500/25'
                  : 'border border-ink/12 text-ink-soft/70 hover:bg-ink/5'
              }`}
            >
              Tout
            </button>
            {GOAL_CHIPS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setActiveChip((prev) => (prev === goal ? null : goal))}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  activeChip === goal
                    ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-md shadow-violet-500/25'
                    : 'border border-ink/12 text-ink-soft/70 hover:bg-ink/5'
                }`}
              >
                {goal}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="relative shrink-0">
              <Globe2 size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="appearance-none rounded-full border border-ink/12 bg-ink/[0.03] py-1.5 pl-7 pr-6 text-xs font-medium text-ink-soft/80 outline-none"
              >
                <option value="">Tous pays</option>
                {CONTINENT_ORDER.map((continent) => (
                  <optgroup key={continent} label={continent}>
                    {COUNTRIES.filter((c) => c.continent === continent).map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="relative shrink-0">
              <select
                value={religionFilter}
                onChange={(e) => setReligionFilter(e.target.value)}
                className="appearance-none rounded-full border border-ink/12 bg-ink/[0.03] py-1.5 px-3 text-xs font-medium text-ink-soft/80 outline-none"
              >
                <option value="">Toutes religions</option>
                {RELIGIONS.map((religion) => (
                  <option key={religion} value={religion}>
                    {religion}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative shrink-0">
              <Plane size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
              <select
                value={travelingOnly ? 'traveling' : ''}
                onChange={(e) => setTravelingOnly(e.target.value === 'traveling')}
                className="appearance-none rounded-full border border-ink/12 bg-ink/[0.03] py-1.5 pl-7 pr-6 text-xs font-medium text-ink-soft/80 outline-none"
              >
                <option value="">Tous</option>
                <option value="traveling">En voyage</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-10 sm:px-6">
        <div>
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

          {!(hasUnseenAnnouncement && latestAnnouncement) && <SupportPromptCard />}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          </div>
        ) : searched.length === 0 ? (
          <div className="glass-panel flex flex-col items-center gap-2 rounded-[28px] p-10 text-center">
            <Sparkles size={40} strokeWidth={1.5} className="text-violet-500" />
            <p className="font-display text-lg font-semibold text-ink">
              🎉 Vous avez découvert tous les profils disponibles pour le moment.
            </p>
            <p className="max-w-xs text-sm text-ink-soft/70">
              Revenez bientôt, ou essayez l'une de ces options en attendant.
            </p>
            <div className="mt-4 flex w-full max-w-xs flex-col gap-2.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={isReviewing}
                onClick={handleReviewProfiles}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw size={16} strokeWidth={2.25} />
                {isReviewing ? 'Chargement…' : 'Revoir les profils'}
              </motion.button>
              <button
                type="button"
                onClick={handleInviteFriends}
                className="flex items-center justify-center gap-2 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
              >
                <Send size={16} strokeWidth={2.25} />
                Inviter des amis
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
              >
                <SlidersHorizontal size={16} strokeWidth={2.25} />
                Élargir mes préférences
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative h-[520px] w-full max-w-sm">
              {deck.map((p, i) => (
                <SwipeCard
                  key={p.id}
                  profile={p}
                  isTop={i === 0}
                  stackIndex={i}
                  exitDirection={exitingId === p.id ? exitDirection : null}
                  onSwipe={(direction) => triggerSwipe(p, direction)}
                  onExited={() => handleExited(p, exitDirection)}
                  onOpenDetail={() => setExpandedProfile(p)}
                />
              ))}
            </div>

            {/* Action row, its own row directly under the card — not overlapping it */}
            <div className="mt-5 flex items-center justify-center gap-5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                disabled={!topProfile}
                onClick={() => topProfile && handlePass(topProfile)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-coral-500 shadow-lg shadow-coral-500/20 ring-1 ring-coral-500/15 disabled:opacity-40 dark:bg-surface-tint"
                aria-label="Passer"
              >
                <X size={24} strokeWidth={2.5} />
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                disabled={!topProfile}
                onClick={() => topProfile && handleSuperlike(topProfile)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-violet-600 shadow-lg shadow-violet-500/20 ring-1 ring-violet-500/15 disabled:opacity-40 dark:bg-surface-tint"
                aria-label="Super like"
              >
                <Star size={22} strokeWidth={2.5} fill="currentColor" />
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                disabled={!topProfile}
                onClick={() => topProfile && setExpandedProfile(topProfile)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink/70 shadow-lg shadow-black/10 ring-1 ring-ink/10 disabled:opacity-40 dark:bg-surface-tint"
                aria-label="Voir le profil"
              >
                <MessageCircle size={22} strokeWidth={2.5} />
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                disabled={!topProfile}
                onClick={() => topProfile && handleLike(topProfile)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-coral-500 text-white shadow-xl shadow-coral-500/40 disabled:opacity-40"
                aria-label="Aimer"
              >
                <Heart size={28} strokeWidth={2.5} fill="currentColor" />
              </motion.button>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft/50">
              <RotateCcw size={12} strokeWidth={2.25} />
              Glissez la carte, ou utilisez les boutons
            </p>

            <div className="mt-8 w-full">
              <div className="flex items-center justify-between px-1">
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
                  👑 Forfaits &amp; Abonnements
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/tarifs')}
                  className="text-xs font-semibold text-violet-600 hover:underline"
                >
                  Tout voir →
                </button>
              </div>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier.name}
                    type="button"
                    onClick={() => navigate('/tarifs')}
                    className={`relative w-40 shrink-0 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 ${
                      tier.highlight ? 'border-coral-500/40' : 'border-ink/10'
                    } ${tier.headerClass}`}
                  >
                    {tier.highlight && (
                      <span className="absolute -top-2 right-3 rounded-full bg-coral-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Top choix
                      </span>
                    )}
                    <p className="text-sm font-bold text-ink">
                      {tier.emoji} {tier.name}
                    </p>
                    <p className="mt-1 text-base font-bold text-ink">
                      {tier.prices[1]?.amount || tier.prices[0].amount}
                      <span className="text-xs font-medium text-ink-soft/60"> /{(tier.prices[1]?.period || tier.prices[0].period).toLowerCase()}</span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {tier.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-center gap-1 text-[11px] text-ink-soft/70">
                          <Check size={11} strokeWidth={3} className="shrink-0 text-mint-600" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
            onBlocked={handleBlocked}
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
                  onError={fallbackToFullPhoto(fullPhotoFor(matchedProfile))}
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
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25"
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
