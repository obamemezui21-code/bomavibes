import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Bell, Compass, Heart, MessageCircle, CircleUserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import PushPermissionPrompt from '../components/PushPermissionPrompt.jsx'

function useNavItems() {
  const { unreadMessagesCount, newMatchesCount } = useConversations()
  const { hasUnseenAnnouncement } = useAuth()
  const { t } = useTranslation()
  return [
    { to: '/discover', label: t('nav.discover'), icon: Compass },
    { to: '/matches', label: t('nav.matches'), icon: Heart, badge: newMatchesCount },
    { to: '/chat', label: t('nav.messages'), icon: MessageCircle, badge: unreadMessagesCount },
    { to: '/annonces', label: t('nav.announcements'), icon: Bell, ring: hasUnseenAnnouncement },
    { to: '/profile', label: t('nav.profile'), icon: CircleUserRound },
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
      y: [0, -3, 0],
      ...(item.ring ? { rotate: [0, -18, 14, -10, 6, -3, 0] } : {}),
    },
    transition: {
      scale: { type: 'spring', stiffness: 500, damping: 15 },
      y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 },
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
  const { t } = useTranslation()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-surface-soft md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-svh md:w-60 md:flex-col md:border-r md:border-ink/8 md:bg-white/70 md:p-4 md:backdrop-blur-xl dark:md:bg-surface/70">
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
                    className={item.ring ? '' : isActive ? 'text-[#2B1D14]' : 'text-ink'}
                    fill={item.ring ? 'currentColor' : 'none'}
                  />
                </motion.span>
                <span className={`relative z-10 flex-1 ${isActive ? 'text-[#2B1D14]' : 'text-ink/80'}`}>
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

      <main className="min-h-svh flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink/8 bg-white/85 backdrop-blur-xl dark:bg-surface/85 md:hidden">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.to
          const anim = iconAnimation(item, i, isActive, 1.15)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-dot"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-violet-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">
                <motion.span
                  className={`inline-flex ${item.ring ? 'text-coral-500' : ''}`}
                  animate={anim.animate}
                  whileTap={{ scale: 0.8 }}
                  transition={anim.transition}
                  style={{ transformOrigin: '50% 0%' }}
                >
                  <item.icon
                    size={22}
                    strokeWidth={2}
                    className={item.ring ? '' : isActive ? 'text-violet-600' : 'text-ink-soft/60'}
                    fill={item.ring ? 'currentColor' : 'none'}
                  />
                </motion.span>
                <NavBadge count={item.badge} />
              </span>
              <span className={item.ring ? 'text-coral-500' : isActive ? 'text-violet-600' : 'text-ink-soft/60'}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </nav>

      <PushPermissionPrompt />
    </div>
  )
}

export default AppLayout
