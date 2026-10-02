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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ConversationsProvider>
              <CallProvider>
                <App />
              </CallProvider>
            </ConversationsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
