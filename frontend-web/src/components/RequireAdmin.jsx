import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FullPageSpinner } from './ui/Spinner.jsx'

// Assumes it's nested inside RequireAuth (see App.jsx) — only adds the
// isAdmin check on top of the auth/onboarding checks already done there.
function RequireAdmin({ children }) {
  const { profile, isProfileLoading } = useAuth()

  if (isProfileLoading) return <FullPageSpinner />
  if (!profile?.isAdmin) return <Navigate to="/discover" replace />

  return children
}

export default RequireAdmin
