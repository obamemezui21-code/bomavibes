const admin = require("../config/firebaseAdmin");
const { isSuperAdminRole } = require("../config/roles");

const db = admin.firestore();

// Must run after requireFirebaseAuth. Stricter than requireAdminMiddleware —
// only the single Super Admin account may pass. Reserved for role
// management and other owner-only actions (nominating/removing Admins).
async function requireSuperAdmin(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        if (!isSuperAdminRole(snap.data()?.role)) {
            return res.status(403).json({ message: "Réservé au Super Admin" });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = requireSuperAdmin;
