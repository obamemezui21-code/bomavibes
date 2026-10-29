import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Fonts served from our own server (not Google Fonts): no visitor IP sent to Google.
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'
import './i18n/index.js'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConversationsProvider } from './context/ConversationsContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import { IdentityProvider } from './context/IdentityContext.jsx'
import { PhotoQualityProvider } from './context/PhotoQualityContext.jsx'
import { GroupCallProvider } from './context/GroupCallContext.jsx'

// A tab opened before a deploy can ask for a code file of the old version
// that's gone by now: reload to get the new version instead of leaving the
// page stuck (at most once every 30 s, so a real outage can't loop).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'bv.reloadedForUpdate'
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) || 0) < 30000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // no storage: still worth one reload
  }
  event.preventDefault()
  window.location.reload()
})

installMediaRetry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <IdentityProvider>
              <PhotoQualityProvider>
                <ConversationsProvider>
                  <CallProvider>
                    <GroupCallProvider>
                      <App />
                    </GroupCallProvider>
                  </CallProvider>
                </ConversationsProvider>
              </PhotoQualityProvider>
            </IdentityProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
