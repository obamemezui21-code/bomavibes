// What a member chose to show on their public profile (Paramètres →
// Confidentialité). Their own screens still show everything.

// ", 26" after a first name — empty when the age is unknown or hidden.
export function ageSuffix(profile) {
  return profile?.age && !profile.hideAge ? `, ${profile.age}` : ''
}

// Chat photos the server flagged as possibly explicit carry "-sensitive" in
// their file name (backend chatAttachmentController.js).
export function isSensitivePhoto(url) {
  return /-sensitive\.jpg$/.test(url || '')
}
