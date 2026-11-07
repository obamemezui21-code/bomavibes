import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Clock, Compass, Heart, ImageUp, MessageCircle, Newspaper, Settings, Ticket } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { usePhotoQuality } from '../context/PhotoQualityContext.jsx'
import { IDENTITY_REQUIRED } from '../lib/identityStatus.js'
import { formatDeadline } from '../lib/photoQuality.js'
import PushPermissionPrompt from '../components/PushPermissionPrompt.jsx'
import AppTopBar from '../components/AppTopBar.jsx'
import NgoriDailyReward from '../components/NgoriDailyReward.jsx'

const SIDEBAR_KEY = 'bomavibes-sidebar'

// Computer format only: the sidebar stays hidden until asked for, and each
// visitor's choice is remembered.
function useSidebar() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'open'
    } catch {
      return false
    }
  })
  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'open' : 'closed')
    } catch {
      // Private window: it just won't be remembered.
    }
  }
  return [open, toggle]
}

function useNavItems() {
  const { unreadMessagesCount, newMatchesCount } = useConversations()
  const { t } = useTranslation()
  return [
    { to: '/discover', label: t('nav.discover'), icon: Compass },
    { to: '/feed', label: t('nav.feed'), icon: Newspaper },
    { to: '/matches', label: t('nav.matches'), icon: Heart, badge: newMatchesCount },
    { to: '/chat', label: t('nav.messages'), icon: MessageCircle, badge: unreadMessagesCount },
    { to: '/events', label: t('nav.events'), icon: Ticket },
  ]
}

function NavBadge({ count }) {
  if (!count) return null
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function iconAnimation(item, i, isActive, activeScale) {
  return {
    animate: {
      scale: isActive ? activeScale : 1,
      ...(item.ring ? { rotate: [0, -18, 14, -10, 6, -3, 0] } : {}),
    },
    transition: {
      scale: { type: 'spring', stiffness: 500, damping: 15 },
      ...(item.ring
        ? { rotate: { duration: 0.7, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' } }
        : {}),
    },
  }
}

function AppLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const navItems = useNavItems()
  const { status: identity } = useIdentity()
  const { status: photoQuality, toFix: photosToFix } = usePhotoQuality()
  const { t } = useTranslation()
  const [sidebarOpen, toggleSidebar] = useSidebar()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-surface-soft">
      <AppTopBar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="desktop:flex">
        {/* No backdrop blur: nothing scrolls under the sidebar, so it blurred nothing,
            and Safari can lose the links of a blurred panel when they repaint. */}
        {/* Maps and games only measure themselves on a window resize, and the
            page has just changed width. */}
        <aside
          id="app-sidebar"
          inert={!sidebarOpen}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget) window.dispatchEvent(new Event('resize'))
          }}
          className={`hidden overflow-hidden transition-[width] duration-200 desktop:sticky desktop:top-14 desktop:flex desktop:h-[calc(100svh-3.5rem)] desktop:shrink-0 desktop:isolate ${
            sidebarOpen ? 'desktop:w-60' : 'desktop:w-0'
          }`}
        >
          <div className="flex w-60 shrink-0 flex-col border-r border-ink/8 bg-surface/60 p-4">
          <div className="mb-8 px-2 pt-2 font-display text-xl font-semibold tracking-tight">
            <span className="text-ink">Boma</span>
            <span className="text-gradient-brand italic">Vibes</span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item, i) => {
              const isActive = location.pathname === item.to
              const anim = iconAnimation(item, i, isActive, 1.12)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 shadow-lg shadow-violet-500/25"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <motion.span
                    className={`relative z-10 inline-flex ${item.ring ? 'text-coral-500' : ''}`}
                    animate={anim.animate}
                    whileTap={{ scale: 0.85 }}
                    transition={anim.transition}
                    style={{ transformOrigin: '50% 0%' }}
                  >
                    <item.icon
                      size={18}
                      strokeWidth={2}
                      className={item.ring ? '' : isActive ? 'text-ink-on-brand' : 'text-ink'}
                      fill={item.ring ? 'currentColor' : 'none'}
                    />
                  </motion.span>
                  <span className={`relative z-10 flex-1 ${isActive ? 'text-ink-on-brand' : 'text-ink/80'}`}>
                    {item.label}
                  </span>
                  {!!item.badge && (
                    <span
                      className={`relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        isActive ? 'bg-white text-violet-600' : 'bg-coral-500 text-white'
                      }`}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-ink/5 ${isActive ? 'bg-violet-500/12 text-violet-700 dark:text-violet-300' : 'text-ink/80'}`
            }
          >
            <Settings size={18} strokeWidth={2} />
            {t('nav.settings')}
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft/60 transition hover:bg-ink/5 hover:text-ink"
          >
            {t('common.logout')}
          </button>
          </div>
        </aside>

        {/* overflow-x-clip (not hidden): nothing a page does can widen the
            viewport, while sticky headers inside pages keep working. */}
        <main className="min-h-[calc(100svh_-_3.5rem)] min-w-0 flex-1 overflow-x-clip pb-[calc(5rem_+_env(safe-area-inset-bottom))] desktop:pb-0">
          {/* Identity under review: limited access (see IdentityContext). */}
          {IDENTITY_REQUIRED && identity === 'pending' && (
            <div className="flex items-center gap-2 border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-700 dark:text-sky-300">
              <Clock size={14} className="shrink-0" />
              Vérification d’identité en cours : vous pourrez liker, écrire et publier dès qu’elle sera validée.
            </div>
          )}
          {/* Photos to fix before the deadline, or the account is suspended (see PhotoQualityContext). */}
          {photoQuality === 'todo' && location.pathname !== '/profile' && (
            <NavLink
              to="/profile"
              className="flex items-center gap-2 border-b border-amber-500/25 bg-amber-500/12 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-200"
            >
              <ImageUp size={14} className="shrink-0" />
              <span className="flex-1">
                Il faut au moins 2 vraies photos de toi, visage visible et en HD.{' '}
                {photosToFix > 1 ? `${photosToFix} photos à corriger` : '1 photo à corriger'} avant le {formatDeadline()}, sinon
                ton compte sera suspendu.
              </span>
              <span className="shrink-0 font-semibold underline">Mettre à jour</span>
            </NavLink>
          )}
          {/* Keyed by the top-level segment only (not the full pathname) so
              opening a chat thread (/chat -> /chat/:id) or a post
              (/feed -> /feed/:postId) doesn't retrigger a full-page fade —
              those are in-page detail views, not a nav-to-nav switch. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname.split('/')[1] || 'root'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating pill, lifted off the bottom edge (Friendzy-style). The gap
          below it grows to clear the iPhone home indicator when there is one. */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-stretch justify-around gap-1 rounded-full border border-ink/8 bg-surface/80 px-2 py-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35),0_4px_12px_-4px_rgba(169,93,218,0.25)] backdrop-blur-2xl desktop:hidden">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.to
          const anim = iconAnimation(item, i, isActive, 1)
          return (
            // Icons only (Friendzy-style): the active tab sits in a filled
            // pink circle; the label stays available to screen readers.
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className="relative flex min-w-0 flex-1 items-center justify-center py-0.5"
            >
              <span className="relative flex h-11 w-11 items-center justify-center">
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill-mobile"
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-2 to-brand-3 shadow-md shadow-pink-500/40"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <motion.span
                  className={`relative inline-flex ${item.ring ? 'text-coral-500' : ''}`}
                  animate={anim.animate}
                  whileTap={{ scale: 0.8 }}
                  transition={anim.transition}
                  style={{ transformOrigin: '50% 0%' }}
                >
                  <item.icon
                    size={21}
                    strokeWidth={2}
                    className={item.ring ? '' : isActive ? 'text-white' : 'text-ink-soft/60'}
                    fill={item.ring ? 'currentColor' : 'none'}
                  />
                </motion.span>
                <NavBadge count={item.badge} />
              </span>
            </NavLink>
          )
        })}
      </nav>

      <PushPermissionPrompt />
      <NgoriDailyReward />
    </div>
  )
}

export default AppLayout
