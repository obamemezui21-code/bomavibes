import { useSyncExternalStore } from 'react'

// true while the app is actually on screen, false when its tab is in the
// background or the phone is locked. Used to pause Firestore heartbeats
// (presence, "active in conversation") nobody can see anyway.
function subscribe(callback) {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

function getSnapshot() {
  return document.visibilityState !== 'hidden'
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
