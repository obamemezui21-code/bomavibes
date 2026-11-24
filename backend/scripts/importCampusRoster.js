// Checks, then imports, the official list of a class into BomaVibes Campus.
// The same checks and the same import as the page (Campus → Administration →
// Liste officielle), for a list kept in a file.
//
// The list holds real names and this repository is public: keep the file in
// backend/private/ (git-ignored), never anywhere else.
//
// Usage:
//   node scripts/importCampusRoster.js <file>            report only, nothing written
//   node scripts/importCampusRoster.js <file> --apply    imports, if there is no error
// Options: --class L1  --label "Licence 1"  --expected 119  --org INASS

require("dotenv").config({ quiet: true });
const fs = require("fs");
const { CONFIG } = require("../src/campus/config");

function option(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
    const file = process.argv[2];
    if (!file || file.startsWith("--")) {
        console.error("Usage: node scripts/importCampusRoster.js <fichier> [--apply] [--class L1] [--expected 119]");
        process.exit(1);
    }
    const code = option("class", CONFIG.defaultClass.code);
    const label = option("label", CONFIG.defaultClass.label);
    const expected = Number(option("expected", CONFIG.defaultClass.expected));
    const org = option("org", CONFIG.defaultOrg);
    const text = fs.readFileSync(file, "utf8").replace(/^\ufeff/, "");

    const admin = require("../src/config/firebaseAdmin");
    const roster = require("../src/campus/rosterController");
    const { slug } = require("../src/campus/config");
    const access = { uid: "script", name: "Script d’importation", email: null, role: "admin", org, appAdmin: true };
    const classId = `${slug(org)}-${slug(code)}`;
    const db = admin.firestore();
    const exists = (await db.collection("campusClasses").doc(classId).get()).exists;

    if (!exists) {
        if (!process.argv.includes("--apply")) {
            const { parseRoster, checkRoster, planImport } = require("../src/campus/roster");
            const entries = parseRoster(text);
            print(checkRoster(entries, expected), planImport(entries, []));
            console.log(`\nLa classe ${code} (${org}) sera créée. Rien n’a été écrit. Pour importer : ajoutez --apply`);
            process.exit(0);
        }
        await roster.createClass(access, { code, label, expected });
        console.log(`Classe ${code} (${org}) créée.`);
    }
    const preview = await roster.previewImport(access, classId, { text, expected });
    print(preview.report, preview.plan);
    if (!process.argv.includes("--apply")) {
        console.log("\nRien n’a été écrit. Pour importer : ajoutez --apply");
        process.exit(0);
    }
    const done = await roster.runImport(access, classId, { text, expected, hash: preview.hash, confirmed: true });
    console.log(`\nImporté : ${done.added} ajoutés, ${done.kept} conservés, ${done.archived} archivés.`);
    console.log(`Relu dans la base : ${done.active} étudiants actifs, ${done.uniqueIds} identifiants uniques, numéros 1 à ${done.active} ${done.numbersOk ? "complets" : "INCOMPLETS"}.`);
    process.exit(0);
}

function print(report, plan) {
    console.log(`Liste : ${report.count} étudiants (attendus : ${report.expected}), numéros ${report.firstNo} à ${report.lastNo}.`);
    const mark = { error: "ERREUR ", warning: "À voir ", info: "Info   " };
    for (const a of report.anomalies) console.log(`  ${mark[a.level]} ${a.message}`);
    if (!report.anomalies.length) console.log("  Aucune anomalie.");
    console.log(`Changements : ${plan.added.length} à ajouter, ${plan.kept.length} conservés, ${plan.archived.length} à archiver.`);
    for (const r of plan.toReconcile) console.log(`  À rapprocher à la main : n° ${r.no} « ${r.name} » et l’ancien « ${r.oldName} » (${r.why}).`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
