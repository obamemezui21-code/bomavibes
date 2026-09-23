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
    MODERATOR: "moderator",
    EDITOR: "editor",
    USER: "user",
});

// Can enter the /admin space at all — the entry gate. Each section inside
// then narrows further with the capability checks below, so a Moderator or
// Editor only sees (and can only call the API for) their own scope. Also
// doubles as "can view the read-only Dashboard" — every elevated role gets
// that as a baseline, see requireDashboardMiddleware.js.
function hasAdminAccess(role) {
    return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.MODERATOR || role === ROLES.EDITOR;
}

// Full admin surface: user management, settings, everything a
// Moderator/Editor doesn't get. NOT the Dashboard — that's hasAdminAccess.
function hasFullAdminAccess(role) {
    return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

// Reports, banning users, removing reported content.
function hasModerationAccess(role) {
    return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.MODERATOR;
}

// Pages/Articles/FAQ/Banners/media library.
function hasContentAccess(role) {
    return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.EDITOR;
}

function isSuperAdminRole(role) {
    return role === ROLES.SUPER_ADMIN;
}

module.exports = {
    SUPER_ADMIN_EMAIL,
    ROLES,
    hasAdminAccess,
    hasFullAdminAccess,
    hasModerationAccess,
    hasContentAccess,
    isSuperAdminRole,
};
