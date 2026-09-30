const admin = require("../config/firebaseAdmin");
const { verifyTurnstile } = require("../services/turnstileService");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIREBASE_ERRORS = {
    "auth/email-already-exists": [409, "Un compte existe déjà avec cet email"],
    "auth/invalid-email": [400, "Adresse email invalide"],
    "auth/invalid-password": [400, "Le mot de passe doit contenir au moins 8 caractères"],
};

// POST /api/auth/register { firstName, email, password, turnstileToken }
// Email/password accounts are created here rather than from the browser so
// the Turnstile check can't be skipped: no valid token, no account. The
// client then signs in normally (users/{uid} setup and the verification
// email follow the usual path in AuthContext).
async function register(req, res) {
    const { firstName, email, password, turnstileToken } = req.body || {};
    const name = typeof firstName === "string" ? firstName.trim() : "";
    if (!name || name.length > 50) return res.status(400).json({ message: "Prénom invalide" });
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return res.status(400).json({ message: "Adresse email invalide" });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" });
    }

    if (!(await verifyTurnstile(turnstileToken, req.ip))) {
        return res.status(400).json({ message: "La vérification anti-robot a échoué, réessayez", code: "turnstile" });
    }

    try {
        await admin.auth().createUser({ email: email.trim(), password, displayName: name });
        res.status(201).json({ created: true });
    } catch (err) {
        const known = FIREBASE_ERRORS[err.code];
        if (known) return res.status(known[0]).json({ message: known[1] });
        console.error(err);
        res.status(500).json({ message: "Impossible de créer le compte, réessayez" });
    }
}

module.exports = { register };
