// One-time migration: generates the -medium/-thumb variants for photos
// uploaded before photoController.js started producing them. Safe to
// re-run — skips any variant that already exists.
//
// Usage:
//   node scripts/backfillPhotoVariants.js

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "profile-photos");

// Keep in sync with backend/src/controllers/photoController.js
const VARIANTS = [
    { suffix: "-medium", maxWidth: 640, quality: 80 },
    { suffix: "-thumb", maxWidth: 240, quality: 75 },
];

function isBasePhoto(filename) {
    // photo-0.jpg, photo-1.jpg, photo-2.jpg — not already a -medium/-thumb variant
    return /^photo-\d+\.jpg$/.test(filename);
}

async function processFile(fullPath) {
    const dir = path.dirname(fullPath);
    const base = path.basename(fullPath, ".jpg");
    let created = 0;

    for (const { suffix, maxWidth, quality } of VARIANTS) {
        const destPath = path.join(dir, `${base}${suffix}.jpg`);
        if (fs.existsSync(destPath)) continue;
        await sharp(fullPath)
            .resize({ width: maxWidth, withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toFile(destPath);
        created += 1;
    }
    return created;
}

async function main() {
    if (!fs.existsSync(UPLOAD_ROOT)) {
        console.log("Aucun dossier de photos trouvé, rien à faire.");
        process.exit(0);
    }

    const userDirs = fs.readdirSync(UPLOAD_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
    let filesProcessed = 0;
    let variantsCreated = 0;
    const failures = [];

    for (const userDir of userDirs) {
        const dirPath = path.join(UPLOAD_ROOT, userDir.name);
        const files = fs.readdirSync(dirPath).filter(isBasePhoto);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            try {
                const created = await processFile(fullPath);
                filesProcessed += 1;
                variantsCreated += created;
            } catch (err) {
                // One corrupt/unsupported source file (e.g. a mislabeled
                // HEIC) must not stop the migration for every other user —
                // record it and keep going.
                failures.push({ path: fullPath, message: err.message });
                console.error(`⚠️  Échec sur ${fullPath} : ${err.message}`);
            }
        }
    }

    console.log(`Terminé : ${filesProcessed} photo(s) analysée(s), ${variantsCreated} variante(s) générée(s).`);
    if (failures.length) {
        console.log(`\n${failures.length} fichier(s) n'ont pas pu être traités et nécessitent une vérification manuelle :`);
        failures.forEach((f) => console.log(`  - ${f.path}\n    ${f.message}`));
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
