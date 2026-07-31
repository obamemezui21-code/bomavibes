import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'

function useNavItems() {
  const { unreadMessagesCount, newMatchesCount } = useConversations()
  return [
    { to: '/discover', label: 'Découvrir', icon: '🔥' },
    { to: '/matches', label: 'Matchs', icon: '❤️', badge: newMatchesCount },
    { to: '/chat', label: 'Messages', icon: '💬', badge: unreadMessagesCount },
    { to: '/profile', label: 'Profil', icon: '👤' },
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

function AppLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const navItems = useNavItems()

  return (
    <div className="min-h-svh bg-ink md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-svh md:w-60 md:flex-col md:border-r md:border-white/8 md:bg-forest-950/60 md:p-4 md:backdrop-blur-xl">
        <div className="mb-8 px-2 pt-2 font-display text-xl font-semibold tracking-tight">
          <span className="text-cream-100">Boma</span>
          <span className="text-gradient-gold italic">Vibes</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 shadow-lg shadow-gold-500/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-forest-950' : 'text-cream-100'}`}>
                  {item.icon}
                </span>
                <span className={`relative z-10 flex-1 ${isActive ? 'text-forest-950' : 'text-cream-200'}`}>
                  {item.label}
                </span>
                {!!item.badge && (
                  <span
                    className={`relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isActive ? 'bg-forest-950 text-cream-100' : 'bg-coral-500 text-white'
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
          onClick={logout}
          className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm font-medium text-cream-300/60 transition hover:bg-white/5 hover:text-cream-100"
        >
          Déconnexion
        </button>
      </aside>

      <main className="min-h-svh flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/8 bg-forest-950/80 backdrop-blur-xl md:hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-dot"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-gold-400"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">
                <span className={`text-lg transition ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                <NavBadge count={item.badge} />
              </span>
              <span className={isActive ? 'text-gold-400' : 'text-cream-300/60'}>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

export default AppLayout
