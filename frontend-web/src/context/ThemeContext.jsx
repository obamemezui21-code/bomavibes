import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'bomavibes-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
