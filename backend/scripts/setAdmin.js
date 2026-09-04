// Grants (or revokes) the isAdmin flag on a Bomavibes account by email.
// This is the only way isAdmin is ever set — firestore.rules explicitly
// forbids a user from setting or changing it on their own account doc, so
// promoting/demoting an admin always goes through this script (Admin SDK
// bypasses the rules).
//
// Usage:
//   node scripts/setAdmin.js <email> [--revoke]

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

async function main() {
    const [email, flag] = process.argv.slice(2);
    if (!email) {
        console.error("Usage: node scripts/setAdmin.js <email> [--revoke]");
        process.exit(1);
    }
    const isAdmin = flag !== "--revoke";

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.firestore().collection("users").doc(userRecord.uid).update({ isAdmin });

    console.log(`${email} (${userRecord.uid}) → isAdmin: ${isAdmin}`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
