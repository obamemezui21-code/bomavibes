// Single source of truth for the role hierarchy, shared by the auth
// middleware, the admin controllers, and scripts/setAdmin.js.
//
// The Super Admin seat is fixed to one account. Nothing in the HTTP API can
// ever grant ROLES.SUPER_ADMIN — it's only ever set by running
// scripts/setAdmin.js directly against the database — which is what
// guarantees an Admin can never self-promote and no other account can ever
// become Super Admin.
const SUPER_ADMIN_EMAIL = "obamemezui21@gmail.com";

const ROLES = Object.freeze({
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    USER: "user",
});

function hasAdminAccess(role) {
    return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

function isSuperAdminRole(role) {
    return role === ROLES.SUPER_ADMIN;
}

module.exports = { SUPER_ADMIN_EMAIL, ROLES, hasAdminAccess, isSuperAdminRole };
