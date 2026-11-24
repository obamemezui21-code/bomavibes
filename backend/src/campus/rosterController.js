const { z } = require("zod");
const { CONFIG, HttpError, nameKey, slug, academicYear, today } = require("./config");
const { parseRoster, checkRoster, planImport, rosterHash, newStudentId } = require("./roster");
const { studentRecord } = require("./stats");
const { isStaff, isAdmin, ROLES } = require("./access");
const { db, col, FieldValue, who, iso, auditEntry, newAudit, getClass, listStudents, classSessions, dropCache } = require("./store");

// Classes, the official list and its import, and the students' own pages.

const NAME = z.string().trim().min(2, "Nom trop court.").max(120, "Nom trop long.");
const REASON = z.string().trim().min(3, "Indiquez le motif.").max(300);

const ClassSchema = z.object({ code: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(60), expected: z.number().int().min(1).max(CONFIG.maxRoster) });

async function createClass(access, body) {
    const data = ClassSchema.parse(body);
    const ref = col.classes().doc(`${slug(access.org)}-${slug(data.code)}`);
    const batch = db.batch();
    batch.create(ref, { org: access.org, ...data, rosterVersion: 0, active: true, createdBy: who(access), createdAt: FieldValue.serverTimestamp() });
    batch.create(newAudit(), auditEntry(access, "class.create", { classId: ref.id, details: data }));
    try {
        await batch.commit();
    } catch (err) {
        if (err.code === 6) throw new HttpError(409, `La classe ${data.code} existe déjà.`);
        throw err;
    }
    return { id: ref.id };
}

async function updateClass(access, classId, body) {
    const data = ClassSchema.partial().parse(body);
    const cls = await getClass(access, classId);
    if (data.code && slug(data.code) !== slug(cls.code)) {
        const all = await col.classes().where("org", "==", access.org).get();
        if (all.docs.some((d) => d.id !== cls.id && slug(d.data().code) === slug(data.code))) throw new HttpError(409, `La classe ${data.code} existe déjà.`);
    }
    const batch = db.batch();
    batch.update(col.classes().doc(cls.id), data);
    batch.create(newAudit(), auditEntry(access, "class.update", { classId: cls.id, from: { code: cls.code, label: cls.label, expected: cls.expected }, to: data }));
    await batch.commit();
}

const ImportSchema = z.object({ text: z.string().min(1, "Collez la liste.").max(60000), expected: z.number().int().min(1).max(CONFIG.maxRoster) });

// The report shown before any import: nothing is written.
async function buildPreview(access, classId, body) {
    const { text, expected } = ImportSchema.parse(body);
    const cls = await getClass(access, classId);
    const entries = parseRoster(text);
    const report = checkRoster(entries, expected);
    const existing = await listStudents(cls.id);
    const plan = planImport(entries, existing);
    return { cls, entries, expected, report, plan, hash: rosterHash(entries, cls.id, cls.rosterVersion) };
}

async function previewImport(access, classId, body) {
    const { cls, entries, report, plan, hash } = await buildPreview(access, classId, body);
    return { className: cls.code, entries: entries.map((e) => ({ no: e.no, name: e.name })), report, plan, hash };
}

// The import itself, for the list whose report was just confirmed (hash).
// No presence status is ever set here.
async function runImport(access, classId, body) {
    const { confirmed, hash } = z.object({ confirmed: z.literal(true, { message: "Confirmez l’importation." }), hash: z.string().min(10) }).parse(body);
    const preview = await buildPreview(access, classId, body);
    if (preview.hash !== hash) throw new HttpError(409, "La liste a changé depuis le contrôle : relancez la vérification.");
    if (!preview.report.ok) throw new HttpError(400, "La liste contient des erreurs : corrigez-les avant d’importer.");
    const { cls, plan, report, expected } = preview;
    const importRef = col.imports().doc();
    const classRef = col.classes().doc(cls.id);
    const version = (cls.rosterVersion || 0) + 1;

    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(classRef);
        if ((fresh.data()?.rosterVersion || 0) !== (cls.rosterVersion || 0)) throw new HttpError(409, "Une autre importation vient d’avoir lieu : relancez la vérification.");
        const ids = new Set();
        for (const a of plan.added) {
            let id = newStudentId();
            while (ids.has(id)) id = newStudentId();
            ids.add(id);
            // create() fails if the identifier already exists: two students can never share one.
            tx.create(col.students().doc(id), {
                org: access.org,
                classId: cls.id,
                name: a.name,
                importNo: a.no,
                active: true,
                nameHistory: [],
                importId: importRef.id,
                createdBy: who(access),
                createdAt: FieldValue.serverTimestamp(),
            });
        }
        for (const k of plan.kept) {
            const patch = { importNo: k.no, active: true, archivedAt: null, importId: importRef.id, updatedAt: FieldValue.serverTimestamp() };
            if (k.renamed) {
                patch.name = k.name;
                patch.nameHistory = FieldValue.arrayUnion({ name: k.oldName, until: new Date().toISOString(), by: access.name });
            }
            tx.update(col.students().doc(k.id), patch);
        }
        // Off the list, but their record and every sheet they are on stay.
        for (const o of plan.archived) tx.update(col.students().doc(o.id), { active: false, archivedAt: FieldValue.serverTimestamp(), archivedByImport: importRef.id });
        const summary = {
            added: plan.added.length,
            kept: plan.kept.length,
            renamed: plan.kept.filter((k) => k.renamed).map((k) => ({ id: k.id, from: k.oldName, to: k.name })),
            archived: plan.archived,
        };
        tx.create(importRef, { org: access.org, classId: cls.id, version, expected, count: report.count, anomalies: report.anomalies, ...summary, by: who(access), at: FieldValue.serverTimestamp() });
        tx.update(classRef, { rosterVersion: version, expected, rosterAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, "roster.import", { classId: cls.id, importId: importRef.id, details: { added: summary.added, kept: summary.kept, renamed: summary.renamed.length, archived: summary.archived.length, version } }));
    });
    dropCache(cls.id);

    // Read back: the list as it is now in the database.
    const students = (await listStudents(cls.id)).filter((s) => s.active);
    return {
        importId: importRef.id,
        added: plan.added.length,
        kept: plan.kept.length,
        archived: plan.archived.length,
        active: students.length,
        uniqueIds: new Set(students.map((s) => s.id)).size,
        numbersOk: students.every((s, i) => s.importNo === i + 1),
    };
}

async function listImports(access, classId) {
    const cls = await getClass(access, classId);
    const snap = await col.imports().where("classId", "==", cls.id).get();
    return snap.docs
        .map((d) => {
            const x = d.data();
            return { id: d.id, version: x.version, expected: x.expected, count: x.count, added: x.added, kept: x.kept, renamed: x.renamed || [], archived: x.archived || [], anomalies: x.anomalies || [], by: x.by?.name || "", at: iso(x.at) };
        })
        .sort((a, b) => b.version - a.version);
}

const publicStudent = (s) => ({ id: s.id, classId: s.classId, name: s.name, no: s.importNo ?? null, active: s.active, archivedAt: iso(s.archivedAt), nameHistory: s.nameHistory || [] });

async function students(access, classId) {
    const cls = await getClass(access, classId);
    const all = await listStudents(cls.id);
    return all.filter((s) => s.active || isStaff(access)).map(publicStudent);
}

// Adding one student by hand, after the import (late enrolment).
async function addStudent(access, classId, body) {
    const { name, force } = z.object({ name: NAME, force: z.boolean().default(false) }).parse(body);
    const cls = await getClass(access, classId);
    const all = await listStudents(cls.id);
    const same = all.find((s) => nameKey(s.name) === nameKey(name));
    if (same && !force) throw new HttpError(409, `« ${same.name} » est déjà dans cette classe${same.active ? "" : " (archivé)"}.`, { code: "SAME_NAME" });
    const id = newStudentId();
    const importNo = Math.max(0, ...all.filter((s) => s.active).map((s) => s.importNo || 0)) + 1;
    const batch = db.batch();
    batch.create(col.students().doc(id), { org: access.org, classId: cls.id, name: name.normalize("NFC"), importNo, active: true, nameHistory: [], createdBy: who(access), createdAt: FieldValue.serverTimestamp() });
    batch.update(col.classes().doc(cls.id), { rosterVersion: FieldValue.increment(1), expected: all.filter((s) => s.active).length + 1 });
    batch.create(newAudit(), auditEntry(access, "student.add", { classId: cls.id, studentId: id, studentName: name }));
    await batch.commit();
    return { id };
}

// Correcting the spelling of a name, or taking a student off (or back on)
// the list. The identifier, and so the history, never changes.
async function updateStudent(access, studentId, body) {
    const data = z.object({ name: NAME.optional(), no: z.number().int().min(1).max(9999).optional(), active: z.boolean().optional(), reason: REASON }).parse(body);
    const ref = col.students().doc(studentId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const s = snap.data();
        if (!s || s.org !== access.org) throw new HttpError(404, "Étudiant introuvable.");
        const patch = { updatedAt: FieldValue.serverTimestamp() };
        const from = {};
        const to = {};
        if (data.name && data.name.normalize("NFC") !== s.name) {
            patch.name = data.name.normalize("NFC");
            patch.nameHistory = FieldValue.arrayUnion({ name: s.name, until: new Date().toISOString(), by: access.name });
            from.name = s.name;
            to.name = patch.name;
        }
        if (data.no !== undefined && data.no !== s.importNo) {
            const same = (await tx.get(col.students().where("classId", "==", s.classId))).docs.find((x) => x.id !== studentId && x.data().active && x.data().importNo === data.no);
            if (same) throw new HttpError(409, `Le numéro ${data.no} est déjà celui de ${same.data().name}.`);
            patch.importNo = data.no;
            from.no = s.importNo ?? null;
            to.no = data.no;
        }
        if (data.active !== undefined && data.active !== s.active) {
            patch.active = data.active;
            patch.archivedAt = data.active ? null : FieldValue.serverTimestamp();
            from.active = s.active;
            to.active = data.active;
            tx.update(col.classes().doc(s.classId), { rosterVersion: FieldValue.increment(1), expected: FieldValue.increment(data.active ? 1 : -1) });
        }
        if (!Object.keys(to).length) throw new HttpError(400, "Aucun changement.");
        tx.update(ref, patch);
        tx.create(newAudit(), auditEntry(access, "student.update", { classId: s.classId, studentId, studentName: s.name, from, to, reason: data.reason }));
    });
}

// A student's page: identity, figures, history (filters: from, to, subjectId, year).
async function studentPage(access, studentId, query = {}) {
    const snap = await col.students().doc(studentId).get();
    const s = snap.data();
    if (!s || s.org !== access.org) throw new HttpError(404, "Étudiant introuvable.");
    const cls = await getClass(access, s.classId);
    let sessions = await classSessions(s.classId, query.year === "all" ? null : query.year || academicYear(today()));
    if (access.role === ROLES.TEACHER) sessions = sessions.filter((x) => x.teacherId === access.teacherId);
    return {
        student: { ...publicStudent({ id: studentId, ...s }), nameHistory: isAdmin(access) ? s.nameHistory || [] : [] },
        className: cls.code,
        classLabel: cls.label,
        org: cls.org,
        record: studentRecord(sessions, studentId, { from: query.from, to: query.to, subjectId: query.subjectId }),
    };
}

module.exports = { createClass, updateClass, previewImport, runImport, listImports, students, addStudent, updateStudent, studentPage };
