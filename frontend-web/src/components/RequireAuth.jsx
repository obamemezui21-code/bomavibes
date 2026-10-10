import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { usePhotoQuality } from '../context/PhotoQualityContext.jsx'
import { IDENTITY_REQUIRED } from '../lib/identityStatus.js'
import { FullPageSpinner } from './ui/Spinner.jsx'

// requireIdentity: new members must have sent their ID document + selfie
// (see IdentityContext) — while it's being reviewed they get in, with
// limited access.
// requireHdPhotos: past HD_PHOTO_DEADLINE, members whose photos aren't HD
// (see PhotoQualityContext) only get to their profile page — to replace
// them — and the settings.
const PHOTO_FIX_PATHS = ['/profile', '/settings']

function RequireAuth({
  children,
  requireVerified = true,
  requireOnboarded = false,
  requireIdentity = false,
  requireHdPhotos = false,
}) {
  const { token, user, profile, isLoading, isProfileLoading } = useAuth()
  const { status: identity } = useIdentity()
  const { blocked: photosBlocked } = usePhotoQuality()
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

  if (requireHdPhotos && photosBlocked && !PHOTO_FIX_PATHS.includes(location.pathname)) {
    return <Navigate to="/profile" replace />
  }

  return children
}

export default RequireAuth
