import { auth } from './config.js'

export async function sendPushNotification(targetUid, type, payload) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return

  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ targetUid, type, payload }),
    })
  } catch {
    // Best-effort: a failed push shouldn't block the match/message flow.
  }
}
