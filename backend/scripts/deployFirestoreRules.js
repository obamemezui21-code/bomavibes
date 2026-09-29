// Publishes frontend-web/firestore.rules to Firestore with the backend's own
// Firebase Admin credentials — no firebase-tools / CLI login needed on the
// server. Called by deploy.sh; safe to run by hand too:
//   node scripts/deployFirestoreRules.js
//
// Skips the release when the live rules already match the file. A rules
// syntax error is reported by Firebase and nothing is released (the
// previous rules stay live).

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const admin = require("../src/config/firebaseAdmin");

const RULES_PATH = path.join(__dirname, "..", "..", "frontend-web", "firestore.rules");

function normalize(source) {
    return source.replace(/\r\n/g, "\n").trim();
}

async function main() {
    const source = fs.readFileSync(RULES_PATH, "utf8");
    const rules = admin.securityRules();

    try {
        const live = await rules.getFirestoreRuleset();
        const liveSource = live.source?.map((f) => f.content).join("\n") || "";
        if (normalize(liveSource) === normalize(source)) {
            console.log("Règles Firestore déjà à jour.");
            return;
        }
    } catch {
        // No readable live ruleset (first release, or no read permission):
        // just try to release.
    }

    const ruleset = await rules.releaseFirestoreRulesetFromSource(source);
    console.log(`Règles Firestore publiées (${ruleset.name}).`);
}

main().catch((err) => {
    console.error("Publication des règles Firestore impossible :", err.message || err);
    process.exit(1);
});
