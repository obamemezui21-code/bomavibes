const crypto = require("crypto");
const { z } = require("zod");
const { CONFIG, HttpError, SESSION, STATUS, isDate, isTime, today, academicYear } = require("./config");
const { countMarks, computeStats, listEvents, byDateDesc } = require("./stats");
const { ROLES, isAdmin, isStaff, canReadSession, canEnter, canCorrect, canCancel } = require("./access");
const { db, col, FieldValue, Timestamp, who, auditEntry, newAudit, publicAudit, getClass, listStudents, classSessions, dropCache, publicSession, isOpen } = require("./store");

// Course sessions and their attendance sheets.

const REASON = z.string().trim().min(3, "Indiquez le motif.").max(300);
const DetailsSchema = z
    .object({
        date: z.string().refine(isDate, "Date invalide."),
        start: z.string().refine(isTime, "Heure de début invalide."),
        end: z.string().refine(isTime, "Heure de fin invalide."),
        subjectId: z.string().min(1, "Choisissez la matière."),
        teacherId: z.string().min(1, "Choisissez l’enseignant."),
        // Attendance at an evaluation is told apart in the reports.
        kind: z.enum(["course", "evaluation"]).default("course"),
    })
    .refine((d) => d.end > d.start, { message: "L’heure de fin doit venir après l’heure de début.", path: ["end"] });

// One per class + date + subject + start: the document that makes a second
// sheet for the same session impossible, even sent twice at once.
const sessionKey = (classId, d) => crypto.createHash("sha1").update(`${classId}|${d.date}|${d.subjectId}|${d.start}`).digest("hex");

async function readNamed(tx, ref, org, what) {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().org !== org) throw new HttpError(400, `${what} introuvable.`);
    return snap.data().name;
}

// The sessions of that class that day which overlap these hours.
async function overlaps(tx, classId, d, exceptId = null) {
    const snap = await tx.get(col.sessions().where("classId", "==", classId).where("date", "==", d.date));
    return snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((s) => s.id !== exceptId && isOpen(s) && s.start < d.end && d.start < s.end);
}

function refuseOverlap(list, d, force) {
    const same = list.find((s) => s.subjectId === d.subjectId);
    if (same) throw new HttpError(409, `Une feuille existe déjà pour ${same.subjectName} ce jour-là, de ${same.start} à ${same.end}.`, { code: "DUPLICATE", sessionId: same.id });
    if (list.length && !force) {
        throw new HttpError(409, `La classe a déjà cours à cette heure : ${list.map((s) => `${s.subjectName} (${s.start}–${s.end})`).join(", ")}.`, { code: "OVERLAP", sessionId: list[0].id });
    }
}

async function createSession(access, body) {
    const d = DetailsSchema.parse(body);
    const cls = await getClass(access, body.classId);
    const roster = (await listStudents(cls.id)).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, no: s.importNo ?? null }));
    if (!roster.length) throw new HttpError(400, "Cette classe n’a pas encore d’étudiants : importez d’abord la liste officielle.");
    const ref = col.sessions().doc();
    const keyRef = col.keys().doc(sessionKey(cls.id, d));
    await db.runTransaction(async (tx) => {
        const [subjectName, teacherName, key, over] = await Promise.all([
            readNamed(tx, col.subjects().doc(d.subjectId), access.org, "Matière"),
            readNamed(tx, col.teachers().doc(d.teacherId), access.org, "Enseignant"),
            tx.get(keyRef),
            overlaps(tx, cls.id, d),
        ]);
        if (key.exists) throw new HttpError(409, "Une feuille existe déjà pour cette séance.", { code: "DUPLICATE", sessionId: key.data().sessionId });
        refuseOverlap(over, d, body.force === true);
        tx.create(ref, {
            org: access.org,
            classId: cls.id,
            classCode: cls.code,
            year: academicYear(d.date),
            ...d,
            subjectName,
            teacherName,
            status: SESSION.DRAFT,
            roster,
            rosterVersion: cls.rosterVersion || 0,
            marks: {},
            counts: countMarks(roster, {}),
            scans: [],
            corrections: 0,
            createdBy: who(access),
            agent: who(access),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        tx.create(keyRef, { sessionId: ref.id, classId: cls.id });
        tx.create(newAudit(), auditEntry(access, "session.create", { sessionId: ref.id, classId: cls.id, details: { date: d.date, start: d.start, end: d.end, subject: subjectName, teacher: teacherName } }));
    });
    dropCache(cls.id);
    return { id: ref.id };
}

// One session inside a transaction, refused unless this account may see it.
async function readSession(tx, access, id) {
    const ref = col.sessions().doc(String(id));
    const snap = tx ? await tx.get(ref) : await ref.get();
    const s = snap.exists ? { id: snap.id, ...snap.data() } : null;
    if (!canReadSession(access, s)) throw new HttpError(404, "Séance introuvable.");
    return { ref, s };
}

const permissions = (access, s) => ({ enter: canEnter(access, s), correct: canCorrect(access, s), cancel: canCancel(access, s), details: canEnter(access, s) || (isAdmin(access) && s.status === SESSION.VALIDATED), scans: canEnter(access, s) || (isAdmin(access) && isOpen(s)), admin: isAdmin(access) });

async function getSession(access, id) {
    const { s } = await readSession(null, access, id);
    const cls = await col.classes().doc(s.classId).get();
    return {
        session: publicSession(s, { full: true }),
        can: permissions(access, s),
        classLabel: cls.data()?.label || "",
        rosterOutdated: s.status === SESSION.DRAFT && (cls.data()?.rosterVersion || 0) !== (s.rosterVersion || 0),
        future: s.date > today(),
    };
}

// List, newest first. filters: classId, year, from, to, subjectId, teacherId, status, q.
async function listSessions(access, query) {
    const cls = await getClass(access, query.classId);
    const year = query.year === "all" ? null : query.year || academicYear(today());
    const rows = (await classSessions(cls.id, year)).filter((s) => canReadSession(access, s));
    const out = rows
        .filter(
            (s) =>
                (!query.from || s.date >= query.from) &&
                (!query.to || s.date <= query.to) &&
                (!query.subjectId || s.subjectId === query.subjectId) &&
                (!query.teacherId || s.teacherId === query.teacherId) &&
                (!query.status || s.status === query.status),
        )
        .sort(byDateDesc);
    return { sessions: out.map((s) => publicSession(s)), year: year || "all" };
}

const MarksSchema = z.object({
    changes: z
        .array(z.object({ id: z.string().min(1), s: z.enum(Object.keys(STATUS)).nullable().optional(), n: z.string().trim().max(300).optional() }))
        .min(1)
        .max(CONFIG.maxRoster),
});

// Entering a draft's marks: only those sent change, so two agents on the
// same sheet don't undo each other. Changing a mark already set is logged.
async function saveMarks(access, id, body) {
    const { changes } = MarksSchema.parse(body);
    let result;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (s.status === SESSION.VALIDATED) throw new HttpError(409, "Cette feuille est validée : utilisez une correction.", { code: "VALIDATED" });
        if (!canEnter(access, s)) throw new HttpError(403, "Vous ne pouvez pas saisir cette feuille.");
        const names = new Map(s.roster.map((r) => [r.id, r.name]));
        const marks = { ...(s.marks || {}) };
        const log = [];
        if (!changes.some((c) => names.has(c.id))) throw new HttpError(400, "Un étudiant ne figure pas sur cette feuille.");
        for (const c of changes) {
            // Taken off this sheet meanwhile: the others are still saved.
            if (!names.has(c.id)) continue;
            const before = marks[c.id] || {};
            const after = { s: c.s === undefined ? (before.s ?? null) : c.s, n: c.n === undefined ? before.n || "" : c.n };
            if ((before.s ?? null) === after.s && (before.n || "") === after.n) continue;
            if (before.s || before.n) log.push({ id: c.id, name: names.get(c.id), from: before.s ?? null, to: after.s, ...(before.n || after.n ? { noteFrom: before.n || "", noteTo: after.n } : {}) });
            if (!after.s && !after.n) delete marks[c.id];
            else marks[c.id] = { ...after, u: access.uid, t: Timestamp.now() };
        }
        const counts = countMarks(s.roster, marks);
        tx.update(ref, { marks, counts, agent: who(access), updatedAt: FieldValue.serverTimestamp() });
        if (log.length) tx.create(newAudit(), auditEntry(access, "marks.update", { sessionId: s.id, classId: s.classId, changes: log }));
        result = { counts, classId: s.classId };
    });
    dropCache(result.classId);
    return { counts: result.counts };
}

// The final save. Empty marks are allowed only when said so explicitly, and
// stay « non renseigné ».
async function validateSession(access, id, body) {
    const { allowUnfilled } = z.object({ confirmed: z.literal(true, { message: "Confirmez l’enregistrement." }), allowUnfilled: z.boolean().default(false) }).parse(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (s.status === SESSION.VALIDATED) throw new HttpError(409, "Cette feuille est déjà validée.", { code: "VALIDATED" });
        if (!canEnter(access, s)) throw new HttpError(403, "Vous ne pouvez pas valider cette feuille.");
        if (s.date > today()) throw new HttpError(400, "Cette séance n’a pas encore eu lieu.");
        const counts = countMarks(s.roster, s.marks);
        if (counts.n === s.roster.length) throw new HttpError(400, "Aucun statut n’est renseigné sur cette feuille.");
        if (counts.n && !allowUnfilled) throw new HttpError(409, `${counts.n} étudiant${counts.n > 1 ? "s ne sont pas renseignés" : " n’est pas renseigné"}.`, { code: "UNFILLED", unfilled: counts.n });
        tx.update(ref, { status: SESSION.VALIDATED, counts, agent: who(access), validatedBy: who(access), validatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, "session.validate", { sessionId: s.id, classId: s.classId, details: counts }));
        classId = s.classId;
    });
    dropCache(classId);
}

// After validation: one student at a time, with a reason. `from` is what the
// person saw: refused if someone changed it meanwhile.
async function correctMark(access, id, body) {
    const d = z
        .object({ studentId: z.string().min(1), from: z.enum(Object.keys(STATUS)).nullable(), s: z.enum(Object.keys(STATUS)).nullable(), n: z.string().trim().max(300).optional(), reason: REASON })
        .parse(body);
    let result;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!canCorrect(access, s)) {
            throw new HttpError(403, s.status === SESSION.VALIDATED ? "Vous ne pouvez plus corriger cette feuille : adressez-vous à l’administrateur." : "Cette feuille n’est pas validée.");
        }
        const student = s.roster.find((r) => r.id === d.studentId);
        if (!student) throw new HttpError(400, "Cet étudiant ne figure pas sur cette feuille.");
        const before = s.marks?.[d.studentId] || {};
        if ((before.s ?? null) !== d.from) throw new HttpError(409, "Ce statut vient d’être modifié par quelqu’un d’autre : rechargez la feuille.", { code: "CHANGED" });
        const note = d.n === undefined ? before.n || "" : d.n;
        if (d.s === d.from && note === (before.n || "")) throw new HttpError(400, "Aucun changement.");
        const marks = { ...(s.marks || {}), [d.studentId]: { s: d.s, n: note, u: access.uid, t: Timestamp.now() } };
        const counts = countMarks(s.roster, marks);
        tx.update(ref, { marks, counts, corrections: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        tx.create(
            newAudit(),
            auditEntry(access, "marks.correct", {
                sessionId: s.id,
                classId: s.classId,
                studentId: student.id,
                studentName: student.name,
                from: { s: before.s ?? null, n: before.n || "" },
                to: { s: d.s, n: note },
                reason: d.reason,
            }),
        );
        result = { counts, classId: s.classId };
    });
    dropCache(result.classId);
    return { counts: result.counts };
}

// Date, hours, subject, teacher. On a validated sheet: administrator, with a reason.
async function updateDetails(access, id, body) {
    const d = DetailsSchema.parse(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!permissions(access, s).details) throw new HttpError(403, "Vous ne pouvez pas modifier cette séance.");
        const reason = s.status === SESSION.VALIDATED ? REASON.parse(body.reason ?? "") : null;
        if (s.status === SESSION.VALIDATED && d.date > today()) throw new HttpError(400, "Une séance validée ne peut pas être dans le futur.");
        const oldKey = sessionKey(s.classId, s);
        const newKey = sessionKey(s.classId, d);
        const [subjectName, teacherName, key, over] = await Promise.all([
            readNamed(tx, col.subjects().doc(d.subjectId), access.org, "Matière"),
            readNamed(tx, col.teachers().doc(d.teacherId), access.org, "Enseignant"),
            tx.get(col.keys().doc(newKey)),
            overlaps(tx, s.classId, d, s.id),
        ]);
        if (key.exists && key.data().sessionId !== s.id) throw new HttpError(409, "Une feuille existe déjà pour cette séance.", { code: "DUPLICATE", sessionId: key.data().sessionId });
        refuseOverlap(over, d, body.force === true);
        tx.update(ref, { ...d, subjectName, teacherName, year: academicYear(d.date), updatedAt: FieldValue.serverTimestamp() });
        if (oldKey !== newKey) {
            tx.delete(col.keys().doc(oldKey));
            tx.set(col.keys().doc(newKey), { sessionId: s.id, classId: s.classId });
        }
        const pick = (x, subject, teacher) => ({ date: x.date, start: x.start, end: x.end, subject, teacher, kind: x.kind || "course" });
        tx.create(newAudit(), auditEntry(access, "session.update", { sessionId: s.id, classId: s.classId, from: pick(s, s.subjectName, s.teacherName), to: pick(d, subjectName, teacherName), reason }));
        classId = s.classId;
    });
    dropCache(classId);
}

// A sheet is never deleted: it is cancelled, with a reason, stays in the
// archives and leaves the figures.
async function cancelSession(access, id, body) {
    const { reason } = z.object({ reason: REASON }).parse(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!canCancel(access, s)) throw new HttpError(403, "Vous ne pouvez pas annuler cette feuille.");
        tx.update(ref, { status: SESSION.CANCELLED, cancelReason: reason, cancelledBy: who(access), cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        tx.delete(col.keys().doc(sessionKey(s.classId, s)));
        tx.create(newAudit(), auditEntry(access, "session.cancel", { sessionId: s.id, classId: s.classId, from: { status: s.status }, to: { status: SESSION.CANCELLED }, reason }));
        classId = s.classId;
    });
    dropCache(classId);
}

// A draft started before the official list changed: newcomers are added
// (with no status); those who left go only if nothing was entered for them.
async function syncRoster(access, id) {
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!canEnter(access, s)) throw new HttpError(403, "Vous ne pouvez pas modifier cette feuille.");
        const cls = await tx.get(col.classes().doc(s.classId));
        const snap = await tx.get(col.students().where("classId", "==", s.classId));
        const active = snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.active);
        const activeIds = new Set(active.map((x) => x.id));
        const roster = [...active.map((x) => ({ id: x.id, name: x.name, no: x.importNo ?? null })), ...s.roster.filter((r) => !activeIds.has(r.id) && s.marks?.[r.id])].sort(
            (a, b) => (a.no ?? 1e9) - (b.no ?? 1e9),
        );
        tx.update(ref, { roster, rosterVersion: cls.data()?.rosterVersion || 0, counts: countMarks(roster, s.marks), updatedAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, "session.roster", { sessionId: s.id, classId: s.classId, details: { before: s.roster.length, after: roster.length } }));
        classId = s.classId;
    });
    dropCache(classId);
}

async function sessionAudit(access, id) {
    const { s } = await readSession(null, access, id);
    const snap = await col.audit().where("sessionId", "==", s.id).get();
    return snap.docs.map(publicAudit).sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1));
}

// The dashboard and the reports: validated sessions only.
async function stats(access, query) {
    const cls = await getClass(access, query.classId);
    const year = query.year === "all" ? null : query.year || academicYear(today());
    const [students, all] = await Promise.all([listStudents(cls.id), classSessions(cls.id, year)]);
    const sessions = all.filter((s) => canReadSession(access, s));
    const filters = { from: query.from, to: query.to, subjectId: query.subjectId, teacherId: access.role === ROLES.TEACHER ? access.teacherId : query.teacherId };
    const validated = sessions.filter((s) => s.status === SESSION.VALIDATED).sort(byDateDesc);
    const latest = [...sessions].filter(isOpen).sort(byDateDesc);
    const active = students.filter((s) => s.active);
    return {
        class: { id: cls.id, org: cls.org, code: cls.code, label: cls.label, expected: cls.expected, active: active.length },
        year: year || "all",
        ...computeStats(sessions, active, filters),
        ...(query.detail === "1" ? { events: listEvents(sessions, students, filters) } : {}),
        last: validated[0] ? publicSession(validated[0]) : null,
        recent: latest.slice(0, 6).map((s) => publicSession(s)),
        drafts: isStaff(access) ? sessions.filter((s) => s.status === SESSION.DRAFT).length : 0,
    };
}

module.exports = { createSession, readSession, permissions, getSession, listSessions, saveMarks, validateSession, correctMark, updateDetails, cancelSession, syncRoster, sessionAudit, stats, sessionKey };
