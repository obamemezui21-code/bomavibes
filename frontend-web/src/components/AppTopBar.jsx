import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, LayoutGrid, MapPin, Menu, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { hasAdminAccess } from '../lib/roles.js'
import logo from '../assets/bomavibes-icon.webp'

const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface text-ink transition hover:bg-ink/8'

// Same button, but only shown on desktop (swaps the display utility rather
// than stacking `hidden` on top of `flex`).
const desktopIconButtonClass = iconButtonClass.replace(/^flex /, 'hidden desktop:flex ')

const menuItemClass =
  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-ink/5'

function AppTopBar() {
  const { profile, publicProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notificationsCount } = useConversations()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  const photoUrl = publicProfile?.photos?.[0]
  const avatarUrl = photoVariant(photoUrl, 'medium')
  const isAdmin = hasAdminAccess(profile?.role)

  // Close the phone menu on any tap outside it.
  useEffect(() => {
    if (!showMenu) return
    function handlePointerDown(e) {
      if (!menuRef.current?.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [showMenu])

  // Secondary shortcuts: inline on desktop, folded into the menu on phones so
  // the mobile header stays as light as the Friendzy one (logo, bell, avatar).
  const shortcuts = [
    ...(isAdmin ? [{ to: '/admin', label: 'Administration', icon: ShieldCheck }] : []),
    { to: '/events', label: 'Événements', icon: LayoutGrid },
    { to: '/coins-chics', label: 'Coins Chics', icon: MapPin },
    { to: '/studio-ia', label: 'Studio IA', icon: Sparkles },
  ]

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 bg-surface-soft/85 px-4 backdrop-blur-xl desktop:border-b desktop:border-ink/8 desktop:bg-surface/80">
      <div className="flex items-center gap-2">
        <img src={logo} alt="BomaVibes" className="h-8 w-8 rounded-2xl object-cover" />
        <span className="font-display text-lg font-bold tracking-tight">
          <span className="text-ink">Boma</span>
          <span className="text-pink-500">Vibes</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {shortcuts.map((s) => (
          <NavLink key={s.to} to={s.to} className={desktopIconButtonClass} aria-label={s.label}>
            <s.icon size={16} strokeWidth={2} />
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleTheme}
          className={desktopIconButtonClass}
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <NavLink to="/notifications" className={`relative ${iconButtonClass}`} aria-label="Notifications">
          <Bell size={16} strokeWidth={2} className="text-sun" />
          {notificationsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">
              {notificationsCount > 9 ? '9+' : notificationsCount}
            </span>
          )}
        </NavLink>

        <div ref={menuRef} className="relative desktop:hidden">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className={iconButtonClass}
            aria-label="Plus"
            aria-expanded={showMenu}
          >
            <Menu size={16} strokeWidth={2} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-11 w-52 overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-ink/8"
              >
                {shortcuts.map((s) => (
                  <NavLink key={s.to} to={s.to} onClick={() => setShowMenu(false)} className={menuItemClass}>
                    <s.icon size={16} strokeWidth={2} className="text-violet-500" />
                    {s.label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme()
                    setShowMenu(false)
                  }}
                  className={`${menuItemClass} border-t border-ink/6`}
                >
                  {theme === 'dark' ? (
                    <Sun size={16} strokeWidth={2} className="text-violet-500" />
                  ) : (
                    <Moon size={16} strokeWidth={2} className="text-violet-500" />
                  )}
                  {theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
