// One-off seed for the Studio IA affiliate directory's starter platforms.
// Safe to re-run: matches existing docs by `nom` and skips them instead of
// duplicating, so re-running after the admin has edited a doc won't stomp
// their changes.
//
// Usage:
//   node scripts/seedAiPartners.js

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");

const db = admin.firestore();

const STARTER_PARTNERS = [
    {
        nom: "Kling AI",
        description: "Génération vidéo IA réaliste à partir d'une photo ou d'un texte.",
        idealPour: "Animer une photo, vidéos réalistes",
        logoUrl: "",
        lienAffilie: "https://kling.ai",
        prixAPartirDe: 0,
        devise: "USD",
        planGratuit: true,
        ordre: 1,
    },
    {
        nom: "PixVerse",
        description: "Création rapide de vidéos courtes pensées pour les réseaux sociaux.",
        idealPour: "Vidéos courtes pour réseaux sociaux",
        logoUrl: "",
        lienAffilie: "https://pixverse.ai",
        prixAPartirDe: 0,
        devise: "USD",
        planGratuit: true,
        ordre: 2,
    },
    {
        nom: "Hailuo AI",
        description: "Génération vidéo IA avec mouvements fluides et personnages animés.",
        idealPour: "Mouvements fluides, personnages",
        logoUrl: "",
        lienAffilie: "https://hailuoai.video",
        prixAPartirDe: 0,
        devise: "USD",
        planGratuit: true,
        ordre: 3,
    },
    {
        nom: "HeyGen",
        description: "Avatars IA qui parlent, pour des vidéos présentées par un personnage virtuel.",
        idealPour: "Avatars IA qui parlent",
        logoUrl: "",
        lienAffilie: "https://www.heygen.com",
        prixAPartirDe: 0,
        devise: "USD",
        planGratuit: true,
        ordre: 4,
    },
];

async function main() {
    const existingSnap = await db.collection("aiPartners").get();
    const existingNames = new Set(existingSnap.docs.map((d) => d.data().nom));

    for (const partner of STARTER_PARTNERS) {
        if (existingNames.has(partner.nom)) {
            console.log(`Skip (déjà présent) : ${partner.nom}`);
            continue;
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection("aiPartners").add({
            ...partner,
            // No verified price yet — prixAPartirDe is a placeholder 0, and
            // the UI shows "Voir le prix" instead of stamping a fake
            // verification date for it.
            prixVerifieLe: null,
            actif: true,
            createdAt: now,
            updatedAt: now,
        });
        console.log(`Créé : ${partner.nom} (${ref.id})`);
    }

    console.log("Terminé.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
