const admin = require("../config/firebaseAdmin");
const { hasModerationAccess } = require("../config/roles");

const db = admin.firestore();

// Must run after requireFirebaseAuth. Passes for ADMIN, SUPER_ADMIN, and
// MODERATOR — the "modération uniquement" role gets exactly this, and
// nothing else in the admin space.
async function requireModeration(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        const role = snap.data()?.role;
        req.userRole = role;
        if (!hasModerationAccess(role)) {
            return res.status(403).json({ message: "Réservé à la modération" });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = requireModeration;
