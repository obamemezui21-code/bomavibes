// Mirrors backend/src/config/roles.js — kept in sync manually since the
// frontend and backend don't share a package.
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
}

export function hasAdminAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}

export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN
}
