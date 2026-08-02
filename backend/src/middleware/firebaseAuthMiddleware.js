const admin = require("../config/firebaseAdmin");

async function requireFirebaseAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Authentification requise" });
    }

    try {
        req.firebaseUser = await admin.auth().verifyIdToken(token);
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: "Session invalide ou expirée" });
    }
}

module.exports = requireFirebaseAuth;
