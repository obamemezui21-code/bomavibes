import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { hasAdminAccess } from '../lib/roles.js'
import { FullPageSpinner } from './ui/Spinner.jsx'

// Assumes it's nested inside RequireAuth (see App.jsx) — only adds the role
// check (ADMIN or SUPER_ADMIN) on top of the auth/onboarding checks already
// done there. For Super-Admin-only routes, see RequireSuperAdmin.
function RequireAdmin({ children }) {
  const { profile, isProfileLoading } = useAuth()

  if (isProfileLoading) return <FullPageSpinner />
  if (!hasAdminAccess(profile?.role)) return <Navigate to="/discover" replace />

  return children
}

export default RequireAdmin
