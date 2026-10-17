import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { getPhotoQuality } from '../firebase/photos.js'
import { PHOTO_DEADLINE } from '../lib/photoQuality.js'

const PhotoQualityContext = createContext(null)

// What's wrong with my profile photos (lib/photoQuality.js), re-checked by
// the server whenever my photos change: not HD (lowRes), not a real photo of
// me (rejected, with the reason), or too few (missing).
//   loading — not known yet
//   ok      — all good (or the check failed: never lock anyone out on an outage)
//   todo    — photos to fix; once PHOTO_DEADLINE has passed (`blocked`) the
//             account is suspended: the app only opens the profile page
export function PhotoQualityProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const hasProfile = Boolean(publicProfile)
  const photosKey = (publicProfile?.photos || []).join('|')
  const [result, setResult] = useState({ key: null, lowRes: [], rejected: [], missing: 0 })
  const [deadlinePassed, setDeadlinePassed] = useState(() => Date.now() > PHOTO_DEADLINE.getTime())

  // An app left open across the deadline locks without a reload.
  useEffect(() => {
    if (deadlinePassed) return undefined
    const wait = PHOTO_DEADLINE.getTime() - Date.now()
    if (wait > 2 ** 31 - 1) return undefined // beyond setTimeout's range: a reload will do
    const timer = setTimeout(() => setDeadlinePassed(true), Math.max(0, wait) + 1000)
    return () => clearTimeout(timer)
  }, [deadlinePassed])

  useEffect(() => {
    if (!user?.id || !hasProfile) return undefined
    let cancelled = false
    getPhotoQuality()
      .then((d) => !cancelled && setResult({ key: photosKey, lowRes: d.lowRes || [], rejected: d.rejected || [], missing: d.missing || 0 }))
      .catch(() => !cancelled && setResult({ key: photosKey, lowRes: [], rejected: [], missing: 0 }))
    return () => {
      cancelled = true
    }
  }, [user?.id, hasProfile, photosKey])

  const known = result.key === photosKey
  const lowRes = known ? result.lowRes : []
  const rejected = known ? result.rejected : []
  const missing = known ? result.missing : 0
  const toFix = lowRes.length + rejected.length + missing
  const status = !user?.id || !known ? 'loading' : toFix ? 'todo' : 'ok'
  const blocked = status === 'todo' && deadlinePassed

  return (
    <PhotoQualityContext.Provider value={{ status, lowRes, rejected, missing, toFix, blocked }}>{children}</PhotoQualityContext.Provider>
  )
}

export function usePhotoQuality() {
  const ctx = useContext(PhotoQualityContext)
  if (!ctx) throw new Error('usePhotoQuality must be used inside PhotoQualityProvider')
  return ctx
}
