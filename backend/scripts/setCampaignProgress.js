// Sets the "Objectif du mois" progress bar shown on the /soutenir page.
// Both numbers are set by hand — there is no automated payment collection
// yet, so currentAmount should only ever reflect contributions you have
// actually confirmed manually (never an estimate).
//
// Usage:
//   node scripts/setCampaignProgress.js <currentAmount> <goalAmount>
//
// Run this yourself whenever the numbers change — it is not triggered
// automatically by code changes or deploys.

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

async function main() {
    const [currentAmountRaw, goalAmountRaw] = process.argv.slice(2);
    const currentAmount = Number(currentAmountRaw);
    const goalAmount = Number(goalAmountRaw);

    if (!Number.isFinite(currentAmount) || !Number.isFinite(goalAmount) || goalAmount <= 0) {
        console.error("Usage: node scripts/setCampaignProgress.js <currentAmount> <goalAmount>");
        process.exit(1);
    }

    const db = admin.firestore();
    await db.collection("campaign").doc("current").set({
        currentAmount,
        goalAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Objectif mis à jour : ${currentAmount} / ${goalAmount} FCFA. Visible immédiatement sur /soutenir.`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
