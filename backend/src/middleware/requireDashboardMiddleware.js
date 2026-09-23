const admin = require("../config/firebaseAdmin");
const { hasAdminAccess } = require("../config/roles");

const db = admin.firestore();

// Must run after requireFirebaseAuth. Passes for any elevated role (ADMIN,
// SUPER_ADMIN, MODERATOR, EDITOR) — the Dashboard is read-only (stats +
// trend charts, no actions), so it's a safe baseline every admin-space role
// gets, unlike requireAdminMiddleware's narrower "full admin" surface.
async function requireDashboard(req, res, next) {
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

module.exports = requireDashboard;
