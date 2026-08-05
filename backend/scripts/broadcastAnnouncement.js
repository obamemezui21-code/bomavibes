// Sends a "new feature" announcement email to every registered user.
//
// Usage:
//   node scripts/broadcastAnnouncement.js "Titre" "Description du texte." ["Label du bouton" "https://lien"]
//
// Run this yourself whenever you want to announce something — it is not
// triggered automatically by code changes or deploys.

require("dotenv").config({ quiet: true });
const admin = require("../src/config/firebaseAdmin");
const resend = require("../src/config/resend");
const { featureAnnouncementEmail } = require("../src/emails/templates");

const FROM_ADDRESS = process.env.RESEND_FROM || "BomaVibes <onboarding@resend.dev>";
const SEND_DELAY_MS = 350; // stay under Resend's rate limit (2 req/s on most plans)

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllUserEmails() {
    const emails = [];
    let pageToken;
    do {
        const result = await admin.auth().listUsers(1000, pageToken);
        for (const user of result.users) {
            if (user.email && !user.disabled) emails.push(user.email);
        }
        pageToken = result.pageToken;
    } while (pageToken);
    return emails;
}

async function main() {
    const [title, description, ctaLabel, ctaLink] = process.argv.slice(2);

    if (!title || !description) {
        console.error('Usage: node scripts/broadcastAnnouncement.js "Titre" "Description" ["Label bouton" "URL"]');
        process.exit(1);
    }

    const emails = await getAllUserEmails();
    console.log(`Envoi à ${emails.length} utilisateur(s)...`);

    const { subject, html } = featureAnnouncementEmail({ title, description, ctaLabel, ctaLink });

    let sent = 0;
    let failed = 0;
    for (const email of emails) {
        try {
            await resend.emails.send({ from: FROM_ADDRESS, to: email, subject, html });
            sent += 1;
        } catch (err) {
            failed += 1;
            console.error(`Échec pour ${email}:`, err.message);
        }
        await sleep(SEND_DELAY_MS);
    }

    console.log(`Terminé — ${sent} envoyé(s), ${failed} échec(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
