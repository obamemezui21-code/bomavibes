import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { IDENTITY_REQUIRED } from '../lib/identityStatus.js'
import { FullPageSpinner } from './ui/Spinner.jsx'

// requireIdentity: new members must have sent their ID document + selfie
// (see IdentityContext) — while it's being reviewed they get in, with
// limited access.
function RequireAuth({ children, requireVerified = true, requireOnboarded = false, requireIdentity = false }) {
  const { token, user, profile, isLoading, isProfileLoading } = useAuth()
  const { status: identity } = useIdentity()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  if (requireVerified && !user?.emailVerified) return <Navigate to="/verify-email" replace />

  if (requireOnboarded) {
    if (isProfileLoading) return <FullPageSpinner />
    if (!profile?.onboarded) return <Navigate to="/onboarding" replace />
  }

  if (requireIdentity && IDENTITY_REQUIRED) {
    if (identity === 'loading') return <FullPageSpinner />
    if (identity === 'todo' || identity === 'rejected') return <Navigate to="/verification" replace />
  }

  return children
}

export default RequireAuth
