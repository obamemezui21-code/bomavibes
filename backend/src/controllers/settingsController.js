// One document (settings/general) for the non-secret app configuration the
// mission asks for. No secrets ever live here — API keys/credentials stay
// in .env, never in Firestore where the admin UI could echo them back.
const admin = require("../config/firebaseAdmin");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();
const SETTINGS_REF = db.collection("settings").doc("general");

const FIELDS = {
    appName: { type: "string", maxLen: 60 },
    supportEmail: { type: "string", maxLen: 200 },
    supportPhone: { type: "string", maxLen: 40 },
    logoUrl: { type: "string", maxLen: 500 },
    faviconUrl: { type: "string", maxLen: 500 },
    minAge: { type: "number" },
    generalNotes: { type: "string", maxLen: 2000 },
    maintenanceMode: { type: "boolean" },
};

const DEFAULTS = {
    appName: "BomaVibes",
    supportEmail: "",
    supportPhone: "",
    logoUrl: "",
    faviconUrl: "",
    minAge: 18,
    generalNotes: "",
    maintenanceMode: false,
};

async function getSettings(req, res) {
    try {
        const snap = await SETTINGS_REF.get();
        res.json({ settings: { ...DEFAULTS, ...snap.data() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function updateSettings(req, res) {
    const payload = {};

    for (const [key, spec] of Object.entries(FIELDS)) {
        if (!(key in req.body)) continue;
        const value = req.body[key];

        if (spec.type === "string") {
            if (typeof value !== "string") return res.status(400).json({ message: `Champ invalide : ${key}` });
            if (spec.maxLen && value.length > spec.maxLen) return res.status(400).json({ message: `Champ trop long : ${key}` });
            payload[key] = value;
        } else if (spec.type === "number") {
            if (typeof value !== "number" || !Number.isFinite(value)) return res.status(400).json({ message: `Champ invalide : ${key}` });
            payload[key] = value;
        } else if (spec.type === "boolean") {
            if (typeof value !== "boolean") return res.status(400).json({ message: `Champ invalide : ${key}` });
            payload[key] = value;
        }
    }

    try {
        await SETTINGS_REF.set(
            { ...payload, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: req.firebaseUser.uid },
            { merge: true },
        );

        await logAdminAction(req, { action: "UPDATE_SETTINGS", metadata: payload });

        const snap = await SETTINGS_REF.get();
        res.json({ settings: { ...DEFAULTS, ...snap.data() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { getSettings, updateSettings };
