// Cloudflare Turnstile — the signup anti-bot check. The browser widget
// hands the form a one-time token; only this server-side call (with
// TURNSTILE_SECRET) can tell whether it's genuine.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

if (!process.env.TURNSTILE_SECRET) {
    console.warn("TURNSTILE_SECRET is not set — signups will be refused until it is (see .env.example).");
}

// → true when Cloudflare confirms the token (each token works only once).
async function verifyTurnstile(token, remoteIp) {
    if (!process.env.TURNSTILE_SECRET || typeof token !== "string" || !token) return false;
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    try {
        const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(10 * 1000) });
        const data = await res.json();
        if (!data.success) console.warn("[turnstile] refusé", data["error-codes"]);
        return data.success === true;
    } catch (err) {
        console.error("[turnstile] vérification impossible", err.message);
        return false;
    }
}

module.exports = { verifyTurnstile };
