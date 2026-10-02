// IDENTITY_REQUIRED: identity verification (ID document + selfie) is
// OPTIONAL for now — it only gives the "Profil vérifié" ✓ badge. Set to
// true (with IDENTITY_REQUIRED in backend/src/services/identityAccess.js
// and identityRequired in firestore.rules) to make it mandatory for members
// who joined after it was introduced (the others are legacyMember).
export const IDENTITY_REQUIRED = false

// Where a member stands with the identity verification:
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
