// Grants (or removes) EDU-CHECK access to an account, by email. The only way
// a role is ever set: eduCheckMembers is closed to the app by firestore.rules
// (no rule opens it), so nobody can grant themselves access.
//
// Usage:
//   node scripts/setEduRole.js <email> teacher [établissement]
//   node scripts/setEduRole.js <email> lead <établissement>
//   node scripts/setEduRole.js <email> none
//
//   teacher  sees only their own analyses;
//   lead     (chargé pédagogique, responsable) also sees those of the
//            teachers of the same institution — give them the same name.

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

async function main() {
    const [email, role, ...orgParts] = process.argv.slice(2);
    const org = orgParts.join(" ").trim() || null;
    if (!email || !["teacher", "lead", "none"].includes(role)) {
        console.error("Usage: node scripts/setEduRole.js <email> <teacher|lead|none> [établissement]");
        process.exit(1);
    }
    if (role === "lead" && !org) {
        console.error("Un responsable (lead) doit être rattaché à un établissement : ajoutez son nom.");
        process.exit(1);
    }
    const user = await admin.auth().getUserByEmail(email);
    const ref = admin.firestore().collection("eduCheckMembers").doc(user.uid);
    if (role === "none") {
        await ref.delete();
        console.log(`${email} (${user.uid}) → accès EDU-CHECK retiré`);
    } else {
        await ref.set({ role, org, email, grantedAt: admin.firestore.FieldValue.serverTimestamp() });
        console.log(`${email} (${user.uid}) → EDU-CHECK : ${role}${org ? ` · ${org}` : ""}`);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
