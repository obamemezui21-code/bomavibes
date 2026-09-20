const admin = require("../config/firebaseAdmin");
const { hasAdminAccess } = require("../config/roles");

const db = admin.firestore();

// Must run after requireFirebaseAuth (needs req.firebaseUser). Reads
// users/{uid}.role straight from Firestore via the Admin SDK — the
// authoritative check, since role can only ever be set server-side
// (see firestore.rules and scripts/setAdmin.js) and never trusted from the
// client's own token. Passes for both ADMIN and SUPER_ADMIN; use
// requireSuperAdminMiddleware for Super-Admin-only routes.
async function requireAdmin(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        const role = snap.data()?.role;
        req.userRole = role;
        if (!hasAdminAccess(role)) {
            return res.status(403).json({ message: "Réservé aux administrateurs" });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = requireAdmin;
