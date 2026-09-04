const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// Must run after requireFirebaseAuth (needs req.firebaseUser). Reads
// users/{uid}.isAdmin straight from Firestore via the Admin SDK — the
// authoritative check, since isAdmin can only ever be set server-side
// (see firestore.rules) and never trusted from the client's own token.
async function requireAdmin(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUser.uid).get();
        if (!snap.data()?.isAdmin) {
            return res.status(403).json({ message: "Réservé aux administrateurs" });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = requireAdmin;
