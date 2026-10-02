// Where a member stands with the mandatory identity verification:
//   loading  — not known yet
//   ok       — verified, or joined before it was mandatory (legacyMember)
//   todo     — must send an ID document + selfie before using the app
//   rejected — sent, refused: must send again
//   pending  — sent, waiting for a moderator: limited access meanwhile
// Mirrors canInteract() in firestore.rules / backend identityAccess.js.
export function identityStatus(publicProfile, request) {
  if (!publicProfile) return 'loading'
  if (publicProfile.verified || publicProfile.legacyMember) return 'ok'
  if (request === undefined) return 'loading'
  if (request?.status === 'pending') return 'pending'
  if (request?.status === 'rejected') return 'rejected'
  return 'todo'
}
