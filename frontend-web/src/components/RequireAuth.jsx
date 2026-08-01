import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Spinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-500" />
    </div>
  )
}

function RequireAuth({ children, requireVerified = true, requireOnboarded = false }) {
  const { token, user, profile, isLoading, isProfileLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Spinner />
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  if (requireVerified && !user?.emailVerified) return <Navigate to="/verify-email" replace />

  if (requireOnboarded) {
    if (isProfileLoading) return <Spinner />
    if (!profile?.onboarded) return <Navigate to="/onboarding" replace />
  }

  return children
}

export default RequireAuth
