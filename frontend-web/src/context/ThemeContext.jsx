import { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_FONT, FONT_STORAGE_KEY, fontById, loadFont } from '../lib/fonts.js'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'bomavibes-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function getInitialFont() {
  try {
    return fontById(window.localStorage.getItem(FONT_STORAGE_KEY)).id
  } catch {
    return DEFAULT_FONT
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [font, setFont] = useState(getInitialFont)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.font = font
    loadFont(font)
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, font)
    } catch {
      // private mode: the choice lasts until the page closes
    }
  }, [font])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, font, setFont }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
