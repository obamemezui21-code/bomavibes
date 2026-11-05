import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { fontById } from '../lib/fonts.js'

// The writing style follows the account: signing in on another device brings
// it along. Sits under AuthProvider, which ThemeProvider wraps.
function FontSync() {
  const { profile } = useAuth()
  const { setFont } = useTheme()
  const saved = profile?.font

  useEffect(() => {
    if (saved) setFont(fontById(saved).id)
  }, [saved, setFont])

  return null
}

export default FontSync
