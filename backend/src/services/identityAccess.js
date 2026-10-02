const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// A member can like, write, call and publish once their identity is
// verified — or if they joined before verification became mandatory
// (legacyMember, see identityMigration.js). Mirrors canInteract() in
// firestore.rules and identityStatus() in the app.
function profileCanInteract(profile) {
    return profile?.verified === true || profile?.legacyMember === true;
}

async function canInteract(uid) {
    const snap = await db.collection("profiles").doc(uid).get();
    return profileCanInteract(snap.data());
}

const IDENTITY_REQUIRED_MESSAGE = "Votre identité doit être vérifiée pour faire cela.";

module.exports = { canInteract, profileCanInteract, IDENTITY_REQUIRED_MESSAGE };
