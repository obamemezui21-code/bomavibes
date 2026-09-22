import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FullPageSpinner } from './ui/Spinner.jsx'

// Generic capability gate for a nested /admin route — pass one of the
// hasXAccess checks from lib/roles.js (e.g. hasModerationAccess). Assumes
// it's nested inside RequireAdmin (see App.jsx), which already handled the
// entry gate and the auth/onboarding checks; this only narrows further for
// Moderator/Editor-scoped sections. The real enforcement is server-side
// (see requireModerationMiddleware.js and firestore.rules) — this is just
// UI routing, never the security boundary itself.
function RequireRole({ check, redirectTo = '/admin', children }) {
  const { profile, isProfileLoading } = useAuth()

  if (isProfileLoading) return <FullPageSpinner />
  if (!check(profile?.role)) return <Navigate to={redirectTo} replace />

  return children
}

export default RequireRole
