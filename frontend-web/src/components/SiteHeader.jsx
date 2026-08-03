import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import logo from '../assets/bomavibes-icon.png'

const NAV_LINKS = [
  { label: 'Accueil', href: '/#top' },
  { label: 'À propos', href: '/#about' },
  { label: 'Premium', href: '/premium' },
  { label: 'Événements', href: '/evenements' },
  { label: 'Contact', href: '/#contact' },
]

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      )}
    </svg>
  )
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/')
    window.scrollTo(0, 0)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-[#1F3D2B]/90 shadow-md backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <a href="/" className="flex items-center">
          <img
            src={logo}
            alt="BomaVibes"
            className="h-10 w-10 rounded-full border-2 border-[#C9962B] object-cover shadow-md"
          />
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-semibold text-white/90 transition hover:text-white">
              {l.label}
            </a>
          ))}
          {token && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-semibold text-white/90 transition hover:text-white"
            >
              Déconnexion
            </button>
          )}
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1F3D2B] shadow-lg backdrop-blur-sm sm:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top' }}
            className="absolute right-4 top-[4.25rem] w-48 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:hidden"
          >
            {NAV_LINKS.map((l, i) => (
              <a
                key={l.label}
                href={l.href}
                className={`block px-5 py-4 text-sm font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5 ${
                  i > 0 ? 'border-t border-black/5' : ''
                }`}
              >
                {l.label}
              </a>
            ))}
            {token && (
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full border-t border-black/5 px-5 py-4 text-left text-sm font-semibold text-coral-500 hover:bg-[#1F3D2B]/5"
              >
                Déconnexion
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export default SiteHeader
