// Mirrors backend/src/config/roles.js — kept in sync manually since the
// frontend and backend don't share a package.
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  EDITOR: 'editor',
  USER: 'user',
}

// Can enter /admin at all — each section then narrows further with the
// capability checks below.
export function hasAdminAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.MODERATOR || role === ROLES.EDITOR
}

// Dashboard/stats, user management — everything a Moderator/Editor doesn't get.
export function hasFullAdminAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}

export function hasModerationAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.MODERATOR
}

export function hasContentAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.EDITOR
}

export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN
}
