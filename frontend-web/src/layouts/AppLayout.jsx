import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Clock, Compass, Heart, MessageCircle, Newspaper, Ticket } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import PushPermissionPrompt from '../components/PushPermissionPrompt.jsx'
import AppTopBar from '../components/AppTopBar.jsx'
import NgoriDailyReward from '../components/NgoriDailyReward.jsx'

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
  const { t } = useTranslation()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-surface-soft">
      <AppTopBar />
      <div className="desktop:flex">
        <aside className="hidden desktop:sticky desktop:top-14 desktop:flex desktop:h-[calc(100svh-3.5rem)] desktop:w-60 desktop:flex-col desktop:border-r desktop:border-ink/8 desktop:bg-surface/60 desktop:p-4 desktop:backdrop-blur-2xl">
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
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 shadow-lg shadow-violet-500/25"
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

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft/60 transition hover:bg-ink/5 hover:text-ink"
          >
            {t('common.logout')}
          </button>
        </aside>

        {/* overflow-x-clip (not hidden): nothing a page does can widen the
            viewport, while sticky headers inside pages keep working. */}
        <main className="min-h-[calc(100svh_-_3.5rem)] min-w-0 flex-1 overflow-x-clip pb-[calc(5rem_+_env(safe-area-inset-bottom))] desktop:pb-0">
          {/* Identity under review: limited access (see IdentityContext). */}
          {identity === 'pending' && (
            <div className="flex items-center gap-2 border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-700 dark:text-sky-300">
              <Clock size={14} className="shrink-0" />
              Vérification d’identité en cours : vous pourrez liker, écrire et publier dès qu’elle sera validée.
            </div>
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
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 shadow-md shadow-pink-500/40"
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
