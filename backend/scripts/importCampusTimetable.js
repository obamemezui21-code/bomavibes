// Puts a week's timetable, kept in a file, into BomaVibes Campus — as a draft:
// someone checks it on the Planning page and publishes it there.
//
// It names teachers and this repository is public: keep the file in
// backend/private/ (git-ignored).
//
// Usage:
//   node scripts/importCampusTimetable.js <file.json>            shows it, writes nothing
//   node scripts/importCampusTimetable.js <file.json> --apply    writes the draft
// Option: --replace, to overwrite a draft of the same week.
//
// The file: { "class": "L1", "week": "2026-11-23", "title": "", "note": "",
//   "periods": [{ "label": "", "start": "08:00", "end": "11:00" }],
//   "days": { "lundi": [{ "subject": "", "teacher": "", "evaluation": true } | null, …], … } }
// with one entry per period for each day.

require("dotenv").config({ quiet: true });
const fs = require("fs");
const { CONFIG, slug, nameKey } = require("../src/campus/config");
const { DAYS } = require("../src/campus/timetable");

async function main() {
    const file = process.argv[2];
    if (!file || file.startsWith("--")) {
        console.error("Usage: node scripts/importCampusTimetable.js <fichier.json> [--apply] [--replace]");
        process.exit(1);
    }
    const t = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    const org = t.org || CONFIG.defaultOrg;
    const classId = `${slug(org)}-${slug(t.class)}`;
    const periods = t.periods.map((p, i) => ({ id: `p${i + 1}`, ...p }));
    const cells = [];
    for (const [name, list] of Object.entries(t.days)) {
        const day = DAYS.findIndex((d) => nameKey(d) === nameKey(name)) + 1;
        if (!day) throw new Error(`Jour inconnu : ${name}`);
        if (list.length > periods.length) throw new Error(`${name} : plus de cours que de périodes.`);
        list.forEach((c, i) => c && cells.push({ day, periodId: periods[i].id, subject: c.subject, teacher: c.teacher || null, kind: c.evaluation ? "evaluation" : "course" }));
    }

    console.log(`${t.title || t.class} — semaine du ${t.week}, ${cells.length} cours`);
    for (const p of periods) {
        console.log(`\n${p.label} (${p.start}–${p.end})`);
        for (const c of cells.filter((x) => x.periodId === p.id)) console.log(`  ${DAYS[c.day - 1].padEnd(9)} ${c.kind === "evaluation" ? "ÉVALUATION " : ""}${c.subject} — ${c.teacher || "enseignant à préciser"}`);
    }
    if (!process.argv.includes("--apply")) {
        console.log("\nRien n’a été écrit. Pour l’enregistrer en brouillon : ajoutez --apply");
        process.exit(0);
    }

    const admin = require("../src/config/firebaseAdmin");
    const { addNamed } = require("../src/campus/adminController");
    const { saveTimetable } = require("../src/campus/timetableController");
    const access = { uid: "script", name: "Script d’importation", email: null, role: "admin", org, appAdmin: true };
    const db = admin.firestore();
    if (!(await db.collection("campusClasses").doc(classId).get()).exists) throw new Error(`La classe ${t.class} n’existe pas encore.`);
    const old = (await db.collection("campusTimetables").doc(`${classId}_${t.week}`).get()).data();
    if (old?.status === "published") throw new Error("Cette semaine a déjà un planning publié : modifiez-le dans l’application.");
    if (old && !process.argv.includes("--replace")) throw new Error("Cette semaine a déjà un brouillon. Pour le remplacer : --replace");

    const ids = new Map();
    const idOf = async (kind, name) => {
        const key = `${kind}|${nameKey(name)}`;
        if (!ids.has(key)) ids.set(key, (await addNamed(access, kind, { name })).id);
        return ids.get(key);
    };
    const slots = [];
    for (const c of cells) slots.push({ day: c.day, periodId: c.periodId, kind: c.kind, subjectId: await idOf("subjects", c.subject), teacherId: c.teacher ? await idOf("teachers", c.teacher) : null });
    await saveTimetable(access, { classId, week: t.week, version: old?.version || 0, title: t.title || "", note: t.note || "", periods, slots });
    console.log("\nEnregistré en brouillon. À vérifier et publier dans Campus → Planning.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
