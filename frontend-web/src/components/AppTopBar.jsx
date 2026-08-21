import { NavLink } from 'react-router-dom'
import { ArrowUp, LayoutGrid, Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import logo from '../assets/bomavibes-icon.png'

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function AppTopBar() {
  const { publicProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const photoUrl = publicProfile?.photos?.[0]
  const avatarUrl = photoVariant(photoUrl, 'medium')

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-ink/8 bg-surface px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <NavLink
          to="/events"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink transition hover:bg-ink/12"
          aria-label="Événements"
        >
          <LayoutGrid size={17} strokeWidth={2} />
        </NavLink>
        <img src={logo} alt="BomaVibes" className="h-8 w-8 rounded-full object-cover" />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink transition hover:bg-ink/12"
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={scrollToTop}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/30 transition hover:brightness-110"
          aria-label="Remonter en haut de la page"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
        <NavLink
          to="/profile"
          className="flex items-center gap-2 rounded-full bg-ink/8 py-1 pl-1 pr-3 transition hover:bg-ink/12"
        >
          {photoUrl ? (
            <img
              src={avatarUrl}
              onError={fallbackToFullPhoto(photoUrl)}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/15 text-xs font-semibold text-ink">
              {publicProfile?.firstName?.[0] || '?'}
            </span>
          )}
          <span className="max-w-[7rem] truncate text-sm font-medium text-ink">
            {publicProfile?.firstName || ''}
          </span>
        </NavLink>
      </div>
    </header>
  )
}

export default AppTopBar
