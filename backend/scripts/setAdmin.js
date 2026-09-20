// Grants (or revokes) a role on a Bomavibes account by email. This is the
// only way a role is ever set — firestore.rules explicitly forbids a user
// from setting or changing their own role, so promoting/demoting always
// goes through this script (Admin SDK bypasses the rules).
//
// This is also the ONLY path that can ever produce a "super_admin" — there
// is no HTTP endpoint for it — which is what guarantees an Admin can never
// self-promote and no account but SUPER_ADMIN_EMAIL can hold the seat.
//
// Usage:
//   node scripts/setAdmin.js <email> [role]
//   role: super_admin | admin | user   (defaults to "admin")

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");
const { SUPER_ADMIN_EMAIL, ROLES } = require("../src/config/roles");

async function main() {
    const [email, roleArg] = process.argv.slice(2);
    if (!email) {
        console.error("Usage: node scripts/setAdmin.js <email> [super_admin|admin|user]");
        process.exit(1);
    }

    const role = roleArg || ROLES.ADMIN;
    if (!Object.values(ROLES).includes(role)) {
        console.error(`Rôle invalide: ${role}. Attendu: ${Object.values(ROLES).join(", ")}`);
        process.exit(1);
    }
    if (role === ROLES.SUPER_ADMIN && email !== SUPER_ADMIN_EMAIL) {
        console.error(`Seul ${SUPER_ADMIN_EMAIL} peut recevoir le rôle super_admin.`);
        process.exit(1);
    }

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.firestore().collection("users").doc(userRecord.uid).update({ role });

    console.log(`${email} (${userRecord.uid}) → role: ${role}`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
