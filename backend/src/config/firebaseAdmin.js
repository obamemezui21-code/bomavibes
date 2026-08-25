const admin = require("firebase-admin");
const path = require("path");

// Env-var credentials are preferred (no private-key file to manage on the
// server); serviceAccountKey.json is kept as a fallback so an already
// deployed server keeps working until its own .env is updated.
function loadCredential() {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
        return admin.credential.cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
    }
    const serviceAccount = require(path.join(__dirname, "..", "..", "serviceAccountKey.json"));
    return admin.credential.cert(serviceAccount);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: loadCredential(),
    });
}

module.exports = admin;
