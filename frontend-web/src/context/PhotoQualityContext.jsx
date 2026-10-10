import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { getPhotoQuality } from '../firebase/photos.js'
import { HD_PHOTO_DEADLINE } from '../lib/photoQuality.js'

const PhotoQualityContext = createContext(null)

// Which of my profile photos aren't HD (lib/photoQuality.js), re-checked by
// the server whenever my photos change.
//   loading — not known yet
//   ok      — every photo is HD (or the check failed: never lock anyone out on an outage)
//   todo    — some photos must be replaced; once HD_PHOTO_DEADLINE has passed
//             (`blocked`) the app only opens the profile page until it's done
export function PhotoQualityProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const hasProfile = Boolean(publicProfile)
  const photosKey = (publicProfile?.photos || []).join('|')
  const [result, setResult] = useState({ key: null, lowRes: [] })
  const [deadlinePassed, setDeadlinePassed] = useState(() => Date.now() > HD_PHOTO_DEADLINE.getTime())

  // An app left open across the deadline locks without a reload.
  useEffect(() => {
    if (deadlinePassed) return undefined
    const wait = HD_PHOTO_DEADLINE.getTime() - Date.now()
    if (wait > 2 ** 31 - 1) return undefined // beyond setTimeout's range: a reload will do
    const timer = setTimeout(() => setDeadlinePassed(true), Math.max(0, wait) + 1000)
    return () => clearTimeout(timer)
  }, [deadlinePassed])

  useEffect(() => {
    if (!user?.id || !hasProfile) return undefined
    let cancelled = false
    getPhotoQuality()
      .then((d) => !cancelled && setResult({ key: photosKey, lowRes: d.lowRes || [] }))
      .catch(() => !cancelled && setResult({ key: photosKey, lowRes: [] }))
    return () => {
      cancelled = true
    }
  }, [user?.id, hasProfile, photosKey])

  const known = result.key === photosKey
  const lowRes = known ? result.lowRes : []
  const status = !user?.id || !known ? 'loading' : lowRes.length ? 'todo' : 'ok'
  const blocked = status === 'todo' && deadlinePassed

  return (
    <PhotoQualityContext.Provider value={{ status, lowRes, blocked }}>{children}</PhotoQualityContext.Provider>
  )
}

export function usePhotoQuality() {
  const ctx = useContext(PhotoQualityContext)
  if (!ctx) throw new Error('usePhotoQuality must be used inside PhotoQualityProvider')
  return ctx
}
