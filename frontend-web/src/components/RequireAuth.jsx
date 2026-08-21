import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FullPageSpinner } from './ui/Spinner.jsx'

function RequireAuth({ children, requireVerified = true, requireOnboarded = false }) {
  const { token, user, profile, isLoading, isProfileLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  if (requireVerified && !user?.emailVerified) return <Navigate to="/verify-email" replace />

  if (requireOnboarded) {
    if (isProfileLoading) return <FullPageSpinner />
    if (!profile?.onboarded) return <Navigate to="/onboarding" replace />
  }

  return children
}

export default RequireAuth
