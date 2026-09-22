import { NavLink } from 'react-router-dom'
import { ArrowUp, Bell, LayoutGrid, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { hasAdminAccess } from '../lib/roles.js'
import logo from '../assets/bomavibes-icon.webp'

const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface text-ink transition hover:bg-ink/8'

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function AppTopBar() {
  const { profile, publicProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notificationsCount } = useConversations()
  const photoUrl = publicProfile?.photos?.[0]
  const avatarUrl = photoVariant(photoUrl, 'medium')

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-ink/8 bg-surface/80 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex items-center gap-2">
        <img src={logo} alt="BomaVibes" className="h-8 w-8 rounded-2xl object-cover" />
        <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
          <span className="text-ink">Boma</span>
          <span className="text-pink-500">Vibes</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {hasAdminAccess(profile?.role) && (
          <NavLink to="/admin" className={iconButtonClass} aria-label="Administration">
            <ShieldCheck size={16} strokeWidth={2} />
          </NavLink>
        )}
        <NavLink to="/events" className={iconButtonClass} aria-label="Événements">
          <LayoutGrid size={16} strokeWidth={2} />
        </NavLink>
        <button
          type="button"
          onClick={toggleTheme}
          className={iconButtonClass}
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={scrollToTop}
          className={iconButtonClass}
          aria-label="Remonter en haut de la page"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
        <NavLink to="/notifications" className={`relative ${iconButtonClass}`} aria-label="Notifications">
          <Bell size={16} strokeWidth={2} className="text-sun" />
          {notificationsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">
              {notificationsCount > 9 ? '9+' : notificationsCount}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/profile"
          className="h-9 w-9 overflow-hidden rounded-full border border-ink/10 bg-surface"
          aria-label="Votre profil"
        >
          {photoUrl ? (
            <img
              src={avatarUrl}
              onError={fallbackToFullPhoto(photoUrl)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink">
              {publicProfile?.firstName?.[0] || '?'}
            </span>
          )}
        </NavLink>
      </div>
    </header>
  )
}

export default AppTopBar
