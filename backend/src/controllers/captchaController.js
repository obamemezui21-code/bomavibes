const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_V2_SECRET_KEY;

async function verifyCaptcha(req, res) {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ success: false, message: "Vérification anti-robot requise" });
    }
    if (!RECAPTCHA_SECRET_KEY) {
        console.error("RECAPTCHA_V2_SECRET_KEY is not set — refusing captcha verification");
        return res.status(500).json({ success: false, message: "Vérification indisponible, réessayez plus tard" });
    }

    try {
        const params = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token });
        const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });
        const data = await response.json();
        if (!data.success) {
            return res.status(400).json({ success: false, message: "Vérification anti-robot invalide, réessayez" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Vérification indisponible, réessayez plus tard" });
    }
}

module.exports = { verifyCaptcha };
