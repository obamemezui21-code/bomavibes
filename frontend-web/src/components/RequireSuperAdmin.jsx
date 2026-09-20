import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isSuperAdmin } from '../lib/roles.js'
import { FullPageSpinner } from './ui/Spinner.jsx'

// Assumes it's nested inside RequireAdmin (see App.jsx) — a plain Admin who
// reaches here gets bounced back to the dashboard hub, not out of it
// entirely, since they do have access to /admin, just not role management.
function RequireSuperAdmin({ children }) {
  const { profile, isProfileLoading } = useAuth()

  if (isProfileLoading) return <FullPageSpinner />
  if (!isSuperAdmin(profile?.role)) return <Navigate to="/admin" replace />

  return children
}

export default RequireSuperAdmin
