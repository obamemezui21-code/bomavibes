const admin = require("../config/firebaseAdmin");
const { hasContentAccess } = require("../config/roles");

const db = admin.firestore();

// Must run after requireFirebaseAuth. Passes for ADMIN, SUPER_ADMIN, and
// EDITOR — the CMS content endpoints (pages/articles/faqs/banners) are the
// Editor's whole scope.
async function requireContent(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        const role = snap.data()?.role;
        req.userRole = role;
        if (!hasContentAccess(role)) {
            return res.status(403).json({ message: "Réservé à la gestion de contenu" });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = requireContent;
