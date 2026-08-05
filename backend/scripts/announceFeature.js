// Publishes an in-app announcement that every user sees in their "Annonces"
// screen (a red dot appears on their Profil tab until they open it).
//
// Usage:
//   node scripts/announceFeature.js "Titre" "Description du texte." ["Label du bouton" "https://lien"]
//
// Run this yourself whenever you want to announce something — it is not
// triggered automatically by code changes or deploys.

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

async function main() {
    const [title, description, ctaLabel, ctaLink] = process.argv.slice(2);

    if (!title || !description) {
        console.error('Usage: node scripts/announceFeature.js "Titre" "Description" ["Label bouton" "URL"]');
        process.exit(1);
    }

    const db = admin.firestore();
    const doc = await db.collection("announcements").add({
        title,
        description,
        ctaLabel: ctaLabel || null,
        ctaLink: ctaLink || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Annonce publiée (id: ${doc.id}). Elle apparaît immédiatement dans l'app pour tous les utilisateurs.`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
