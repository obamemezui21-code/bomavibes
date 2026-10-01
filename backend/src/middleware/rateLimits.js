const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Request limits, kept in memory (a single API process — see pm2). Mobile
// carriers in Gabon put many subscribers behind one public IP (CGNAT), so
// per-IP limits are deliberately generous; the tight limits key on what an
// abuser can't multiply for free (the target email address).

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function limiter({ windowMs, limit, message, keyGenerator, skip }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator,
        skip,
        handler: (req, res) => res.status(429).json({ message }),
    });
}

const TOO_MANY = "Trop de requêtes, réessayez dans quelques minutes.";

// Every /api call. SingPay's callback is exempt: it always comes from the
// same few SingPay IPs and must never be dropped.
const apiLimiter = limiter({
    windowMs: 5 * MINUTE,
    limit: 1500,
    message: TOO_MANY,
    skip: (req) => req.path === "/payments/singpay/callback",
});

const registerLimiter = limiter({
    windowMs: HOUR,
    limit: 20,
    message: "Trop de créations de compte depuis cette connexion. Réessayez dans une heure.",
});

const passwordResetIpLimiter = limiter({
    windowMs: HOUR,
    limit: 10,
    message: "Trop de demandes de réinitialisation. Réessayez dans une heure.",
});

// Stops anyone from flooding one person's inbox (and our Resend quota).
const passwordResetEmailLimiter = limiter({
    windowMs: HOUR,
    limit: 3,
    message: "Trop de demandes pour cette adresse. Vérifiez votre boîte mail (et les spams) ou réessayez dans une heure.",
    keyGenerator: (req) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        return email ? `email:${email}` : ipKeyGenerator(req.ip);
    },
});

// Per account — must run after requireFirebaseAuth.
const verificationEmailLimiter = limiter({
    windowMs: HOUR,
    limit: 5,
    message: "Trop d'e-mails de vérification envoyés. Réessayez dans une heure.",
    keyGenerator: (req) => `uid:${req.firebaseUser.uid}`,
});

// NGORI RUN — per account, generous for real play (a run takes two calls)
// but stops scripted request floods. Must run after requireFirebaseAuth.
const ngoriRunLimiter = limiter({
    windowMs: 10 * MINUTE,
    limit: 80,
    message: "Doucement ! Trop de parties d'affilée, réessayez dans quelques minutes.",
    keyGenerator: (req) => `uid:${req.firebaseUser.uid}`,
});

module.exports = {
    apiLimiter,
    ngoriRunLimiter,
    registerLimiter,
    passwordResetIpLimiter,
    passwordResetEmailLimiter,
    verificationEmailLimiter,
};
