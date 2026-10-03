const admin = require("../config/firebaseAdmin");
const resend = require("../config/resend");
const { passwordResetEmail, verificationEmail } = require("../emails/templates");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const FROM_ADDRESS = process.env.RESEND_FROM || "BomaVibes <onboarding@resend.dev>";

const actionCodeSettings = {
    url: `${FRONTEND_URL}/auth/action`,
    handleCodeInApp: true,
};

// The Resend SDK doesn't throw on failure (bad domain, quota, invalid
// recipient…): it resolves with { error }. Without this check a failed send
// was reported as sent and the user waited for an email that never came.
async function sendEmail(message) {
    const { error } = await resend.emails.send(message);
    if (error) throw Object.assign(new Error(error.message || "Resend error"), { resend: error });
}

// Firebase's generated links always route through <project>.firebaseapp.com first
// and render Firebase's own hosted UI there, regardless of actionCodeSettings/continueUrl.
// To get our own branded page instead, pull the oobCode out of Firebase's link and
// build our own direct URL with it — confirmPasswordReset/applyActionCode only need
// a valid code, not Firebase's suggested destination.
function buildDirectLink(firebaseLink, mode) {
    const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
    return `${FRONTEND_URL}/auth/action?mode=${mode}&oobCode=${oobCode}`;
}

async function sendPasswordReset(req, res) {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email requis" });
    }

    try {
        const firebaseLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        const link = buildDirectLink(firebaseLink, "resetPassword");
        const { subject, html } = passwordResetEmail(link);
        await sendEmail({ from: FROM_ADDRESS, to: email, subject, html });
    } catch (err) {
        // Never reveal whether an account exists for this email.
        if (err?.code !== "auth/user-not-found") {
            console.error(err);
        }
    }

    res.json({ message: "Si un compte existe, un email a été envoyé." });
}

async function sendVerification(req, res) {
    const { email, name } = req.firebaseUser;

    if (!email) {
        return res.status(400).json({ message: "Aucun email associé à ce compte" });
    }

    try {
        const firebaseLink = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
        const link = buildDirectLink(firebaseLink, "verifyEmail");
        const { subject, html } = verificationEmail(link, name);
        await sendEmail({ from: FROM_ADDRESS, to: email, subject, html });
        res.json({ message: "Email de vérification envoyé" });
    } catch (err) {
        // Firebase allows about one verification link per account per
        // minute. Nothing was sent, so the previous email's link still works
        // (each new link cancels the previous one).
        if (String(err?.message).includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
            return res.status(429).json({
                message: "Un email vient déjà de partir : utilisez son lien, ou attendez une minute pour en demander un autre.",
            });
        }
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer l'email de vérification" });
    }
}

module.exports = { sendPasswordReset, sendVerification };
