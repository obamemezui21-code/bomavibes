const fs = require("fs");
const { z } = require("zod");
const { HttpError, SESSION, nameKey } = require("./config");
const { countMarks } = require("./stats");
const { isMonday } = require("./timetable");
const { db, col, FieldValue, who, iso, auditEntry, newAudit, getClass, dropCache, isOpen } = require("./store");
const { readSession, sessionKey } = require("./sessionController");
const { dirOf } = require("./scanController");

// What only the institution's administrator may do: reopen, restore, change
// who is on a sheet, replace, and delete anything.
//
// Deleting moves things to the bin, campusTrash/{id}: whole, with who, when
// and why. From there they are put back as they were, or erased for good.
// The log (campusAudit) has no such door: it is never erased.

const trash = () => db.collection("campusTrash");
const timetables = () => db.collection("campusTimetables");
const REASON = z.string().trim().min(3, "Indiquez le motif.").max(300);
const reasonOf = (body) => z.object({ reason: REASON }).parse(body || {}).reason;

// Firestore allows 500 writes in a transaction.
const MAX_WRITES = 450;

function putInTrash(tx, access, { type, label, classId = null, reason, docs, extra = null }) {
    const ref = trash().doc();
    tx.create(ref, { org: access.org, type, label, classId, reason, docs: docs.map((d) => ({ path: d.ref.path, data: d.data })), extra, by: who(access), at: FieldValue.serverTimestamp() });
    for (const d of docs) tx.delete(d.ref);
    tx.create(newAudit(), auditEntry(access, `${type}.delete`, { classId, details: { label, trashId: ref.id }, reason, ...(type === "session" ? { sessionId: docs[0].ref.id } : {}) }));
    return ref.id;
}

const sessionLabel = (s) => `${s.subjectName}, ${s.date.split("-").reverse().join("/")} ${s.start}–${s.end}`;

// ---- Sheets ----

async function deleteSession(access, id, body) {
    const reason = reasonOf(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        const { id: _id, ...data } = s;
        putInTrash(tx, access, { type: "session", label: sessionLabel(s), classId: s.classId, reason, docs: [{ ref, data }] });
        if (isOpen(s)) tx.delete(col.keys().doc(sessionKey(s.classId, s)));
        classId = s.classId;
    });
    dropCache(classId);
}

// A validated sheet back to entry: its marks stay, it leaves the figures
// until it is validated again.
async function reopenSession(access, id, body) {
    const reason = reasonOf(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (s.status !== SESSION.VALIDATED) throw new HttpError(409, "Cette feuille n’est pas validée.");
        tx.update(ref, { status: SESSION.DRAFT, validatedBy: null, validatedAt: null, updatedAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, "session.reopen", { sessionId: s.id, classId: s.classId, details: s.counts, reason }));
        classId = s.classId;
    });
    dropCache(classId);
}

// A cancelled sheet back as it was.
async function restoreSession(access, id, body) {
    const reason = reasonOf(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (s.status !== SESSION.CANCELLED) throw new HttpError(409, "Cette feuille n’est pas annulée.");
        const keyRef = col.keys().doc(sessionKey(s.classId, s));
        const key = await tx.get(keyRef);
        if (key.exists) throw new HttpError(409, "Une autre feuille existe maintenant pour cette séance.", { sessionId: key.data().sessionId });
        const status = s.validatedAt ? SESSION.VALIDATED : SESSION.DRAFT;
        tx.update(ref, { status, cancelReason: null, cancelledBy: null, cancelledAt: null, updatedAt: FieldValue.serverTimestamp() });
        tx.create(keyRef, { sessionId: s.id, classId: s.classId });
        tx.create(newAudit(), auditEntry(access, "session.restore", { sessionId: s.id, classId: s.classId, from: { status: s.status }, to: { status }, reason }));
        classId = s.classId;
    });
    dropCache(classId);
}

const byNo = (a, b) => (a.no ?? 1e9) - (b.no ?? 1e9) || a.name.localeCompare(b.name, "fr");

// Who is on one sheet. Added with no status; removed with theirs (logged).
async function updateSheetStudents(access, id, body) {
    const d = z.object({ add: z.array(z.string()).max(100).default([]), remove: z.array(z.string()).max(400).default([]), reason: REASON }).parse(body || {});
    if (!d.add.length && !d.remove.length) throw new HttpError(400, "Aucun changement.");
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!isOpen(s)) throw new HttpError(409, "Cette feuille est annulée.");
        const snaps = await Promise.all(d.add.map((x) => tx.get(col.students().doc(x))));
        const added = snaps.map((x) => {
            if (!x.exists || x.data().org !== access.org) throw new HttpError(400, "Étudiant introuvable.");
            return { id: x.id, name: x.data().name, no: x.data().importNo ?? null };
        });
        const removed = s.roster.filter((r) => d.remove.includes(r.id));
        const roster = [...s.roster.filter((r) => !d.remove.includes(r.id)), ...added.filter((a) => !s.roster.some((r) => r.id === a.id))].sort(byNo);
        if (!roster.length) throw new HttpError(400, "Une feuille doit garder au moins un étudiant.");
        const marks = Object.fromEntries(Object.entries(s.marks || {}).filter(([k]) => !d.remove.includes(k)));
        tx.update(ref, { roster, marks, counts: countMarks(roster, marks), updatedAt: FieldValue.serverTimestamp() });
        tx.create(
            newAudit(),
            auditEntry(access, "session.students", {
                sessionId: s.id,
                classId: s.classId,
                details: { added: added.map((a) => a.name), removed: removed.map((r) => ({ id: r.id, name: r.name, s: s.marks?.[r.id]?.s ?? null, n: s.marks?.[r.id]?.n || "" })) },
                reason: d.reason,
            }),
        );
        classId = s.classId;
    });
    dropCache(classId);
}

// ---- Students ----

// fromSheets: also takes them off every sheet (kept in the bin with their
// marks). Otherwise the sheets keep their name and their statuses.
async function deleteStudent(access, id, body) {
    const { reason, fromSheets } = z.object({ reason: REASON, fromSheets: z.boolean().default(false) }).parse(body || {});
    const ref = col.students().doc(id);
    let out;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const s = snap.data();
        if (!s || s.org !== access.org) throw new HttpError(404, "Étudiant introuvable.");
        const sheets = (await tx.get(col.sessions().where("classId", "==", s.classId))).docs.filter((x) => x.data().roster.some((r) => r.id === id));
        if (fromSheets && sheets.length > MAX_WRITES) throw new HttpError(400, "Trop de feuilles à modifier d’un coup : archivez plutôt cet étudiant.");
        const marks = [];
        if (fromSheets) {
            for (const sheet of sheets) {
                const x = sheet.data();
                marks.push({ sessionId: sheet.id, entry: x.roster.find((r) => r.id === id), mark: x.marks?.[id] || null });
                const roster = x.roster.filter((r) => r.id !== id);
                const left = { ...(x.marks || {}) };
                delete left[id];
                tx.update(sheet.ref, { roster, marks: left, counts: countMarks(roster, left), updatedAt: FieldValue.serverTimestamp() });
            }
        }
        if (s.active) tx.update(col.classes().doc(s.classId), { rosterVersion: FieldValue.increment(1), expected: FieldValue.increment(-1) });
        putInTrash(tx, access, { type: "student", label: s.name, classId: s.classId, reason, docs: [{ ref, data: s }], extra: { marks } });
        out = { sheets: sheets.length, classId: s.classId };
    });
    dropCache(out.classId);
    return { sheets: fromSheets ? out.sheets : 0 };
}

// ---- Classes ----

async function deleteClass(access, id, body) {
    const reason = reasonOf(body);
    const cls = await getClass(access, id);
    await db.runTransaction(async (tx) => {
        const ref = col.classes().doc(cls.id);
        const [snap, sessions, weeks, students] = await Promise.all([
            tx.get(ref),
            tx.get(col.sessions().where("classId", "==", cls.id).limit(1)),
            tx.get(timetables().where("classId", "==", cls.id).limit(1)),
            tx.get(col.students().where("classId", "==", cls.id)),
        ]);
        if (!sessions.empty || !weeks.empty) throw new HttpError(409, "Cette classe a encore des feuilles ou des plannings : supprimez-les d’abord.");
        if (students.size > MAX_WRITES) throw new HttpError(400, "Trop d’étudiants à supprimer d’un coup.");
        putInTrash(tx, access, { type: "class", label: `${cls.code} – ${cls.label} (${students.size} étudiants)`, classId: cls.id, reason, docs: [{ ref, data: snap.data() }, ...students.docs.map((d) => ({ ref: d.ref, data: d.data() }))] });
    });
    dropCache(cls.id);
}

// ---- Timetables ----

async function deleteTimetable(access, body) {
    const { classId, week, reason } = z.object({ classId: z.string(), week: z.string().refine(isMonday, "Semaine invalide."), reason: REASON }).parse(body || {});
    const cls = await getClass(access, classId);
    await db.runTransaction(async (tx) => {
        const ref = timetables().doc(`${cls.id}_${week}`);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpError(404, "Planning introuvable.");
        putInTrash(tx, access, { type: "timetable", label: `Planning ${cls.code}, semaine du ${week.split("-").reverse().join("/")}`, classId: cls.id, reason, docs: [{ ref, data: snap.data() }] });
    });
}

// ---- Subjects and teachers ----

const KINDS = {
    subjects: { type: "subject", id: "subjectId", name: "subjectName", what: "matière" },
    teachers: { type: "teacher", id: "teacherId", name: "teacherName", what: "enseignant" },
};

// Where one is used: sheets and timetables of this institution.
async function usage(tx, access, kind, id) {
    const k = KINDS[kind];
    const [sessions, weeks, members] = await Promise.all([
        tx.get(col.sessions().where(k.id, "==", id)),
        tx.get(timetables().where("org", "==", access.org)),
        kind === "teachers" ? tx.get(col.members().where("teacherId", "==", id)) : null,
    ]);
    return { sessions: sessions.docs.filter((d) => d.data().org === access.org), weeks: weeks.docs.filter((d) => d.data().slots.some((s) => s[k.id] === id)), members: members ? members.docs.filter((d) => d.data().org === access.org) : [] };
}

// Renames it everywhere: catalogue, sheets and timetables.
async function renameEverywhere(access, kind, id, body) {
    const name = z.object({ name: z.string().trim().min(2, "Nom trop court.").max(100) }).parse(body || {}).name.normalize("NFC");
    const k = KINDS[kind];
    const ref = col[kind]().doc(id);
    let count;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.data();
        if (!old || old.org !== access.org) throw new HttpError(404, "Introuvable.");
        const all = await tx.get(col[kind]().where("org", "==", access.org));
        const twin = all.docs.find((d) => d.id !== id && nameKey(d.data().name) === nameKey(name));
        if (twin) throw new HttpError(409, `« ${twin.data().name} » existe déjà : utilisez « Supprimer » puis « remplacer par ».`, { code: "SAME_NAME", id: twin.id });
        const used = await usage(tx, access, kind, id);
        if (used.sessions.length + used.weeks.length > MAX_WRITES) throw new HttpError(400, "Trop de feuilles à modifier d’un coup.");
        tx.update(ref, { name });
        for (const d of used.sessions) tx.update(d.ref, { [k.name]: name });
        for (const d of used.weeks) tx.update(d.ref, { slots: d.data().slots.map((s) => (s[k.id] === id ? { ...s, [k.name]: name } : s)), version: FieldValue.increment(1) });
        tx.create(newAudit(), auditEntry(access, `${k.type}.update`, { targetId: id, from: { name: old.name }, to: { name }, details: { sheets: used.sessions.length, weeks: used.weeks.length } }));
        count = { sheets: used.sessions.length, weeks: used.weeks.length };
    });
    dropCache();
    return count;
}

// Deletes one. If it is in use, another must take its place on every sheet
// and timetable (replaceBy): nothing is left pointing at nothing.
async function deleteNamed(access, kind, id, body) {
    const { reason, replaceBy } = z.object({ reason: REASON, replaceBy: z.string().nullable().default(null) }).parse(body || {});
    const k = KINDS[kind];
    const ref = col[kind]().doc(id);
    let out;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.data();
        if (!old || old.org !== access.org) throw new HttpError(404, "Introuvable.");
        const used = await usage(tx, access, kind, id);
        const total = used.sessions.length + used.weeks.length + used.members.length;
        out = { sheets: used.sessions.length, weeks: used.weeks.length, members: used.members.length };
        if (total && !replaceBy) throw new HttpError(409, `« ${old.name} » est utilisé : ${out.sheets} feuille(s), ${out.weeks} planning(s)${out.members ? `, ${out.members} compte(s)` : ""}. Choisissez par quoi le remplacer.`, { code: "IN_USE", usage: out });
        if (total) {
            if (replaceBy === id) throw new HttpError(400, "Choisissez un autre remplaçant.");
            const other = await tx.get(col[kind]().doc(replaceBy));
            if (!other.exists || other.data().org !== access.org) throw new HttpError(400, "Remplaçant introuvable.");
            if (total * 3 > MAX_WRITES) throw new HttpError(400, "Trop de feuilles à modifier d’un coup.");
            const name = other.data().name;
            // A sheet's key holds its subject: it changes with it.
            const moves = [];
            if (kind === "subjects") {
                for (const d of used.sessions) {
                    const s = d.data();
                    if (!isOpen(s)) continue;
                    const to = col.keys().doc(sessionKey(s.classId, { ...s, subjectId: replaceBy }));
                    if ((await tx.get(to)).exists) throw new HttpError(409, `Il y a déjà une feuille de ${name} pour ${sessionLabel(s)} : supprimez l’une des deux d’abord.`, { sessionId: d.id });
                    moves.push({ from: col.keys().doc(sessionKey(s.classId, s)), to, sessionId: d.id, classId: s.classId });
                }
            }
            for (const m of moves) {
                tx.delete(m.from);
                tx.set(m.to, { sessionId: m.sessionId, classId: m.classId });
            }
            for (const d of used.sessions) tx.update(d.ref, { [k.id]: replaceBy, [k.name]: name });
            for (const d of used.weeks) tx.update(d.ref, { slots: d.data().slots.map((s) => (s[k.id] === id ? { ...s, [k.id]: replaceBy, [k.name]: name } : s)), version: FieldValue.increment(1) });
            for (const d of used.members) tx.update(d.ref, { teacherId: replaceBy });
            out.replacedBy = name;
        }
        putInTrash(tx, access, { type: k.type, label: out.replacedBy ? `${old.name} (remplacé par ${out.replacedBy})` : old.name, reason, docs: [{ ref, data: old }] });
    });
    dropCache();
    return out;
}

// ---- The bin ----

async function listTrash(access) {
    const snap = await trash().where("org", "==", access.org).get();
    return snap.docs
        .map((d) => {
            const t = d.data();
            return { id: d.id, type: t.type, label: t.label, reason: t.reason, by: t.by?.name || "", at: iso(t.at) };
        })
        .sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1));
}

async function readTrash(tx, access, id) {
    const ref = trash().doc(id);
    const snap = await tx.get(ref);
    const t = snap.data();
    if (!t || t.org !== access.org) throw new HttpError(404, "Élément introuvable dans la corbeille.");
    return { ref, t };
}

// Back exactly as it was, unless its place has been taken since.
async function restoreTrash(access, id) {
    let type;
    await db.runTransaction(async (tx) => {
        const { ref, t } = await readTrash(tx, access, id);
        const refs = t.docs.map((d) => db.doc(d.path));
        const main = t.docs[0].data;
        const [existing, cls] = await Promise.all([Promise.all(refs.map((r) => tx.get(r))), t.classId && t.type !== "class" ? tx.get(col.classes().doc(t.classId)) : null]);
        if (existing.some((x) => x.exists)) throw new HttpError(409, t.type === "timetable" ? "Cette semaine a de nouveau un planning : supprimez-le d’abord." : "Un élément identique existe déjà.");
        if (cls && !cls.exists) throw new HttpError(409, "Sa classe a été supprimée : restaurez d’abord la classe.");

        let key = null;
        if (t.type === "session" && isOpen(main)) {
            key = col.keys().doc(sessionKey(main.classId, main));
            if ((await tx.get(key)).exists) throw new HttpError(409, "Une autre feuille existe maintenant pour cette séance.");
        }
        if (t.type === "subject" || t.type === "teacher") {
            const all = await tx.get(col[`${t.type}s`]().where("org", "==", access.org));
            if (all.docs.some((d) => nameKey(d.data().name) === nameKey(main.name))) throw new HttpError(409, `« ${main.name} » existe déjà.`);
        }
        const marks = t.type === "student" ? t.extra?.marks || [] : [];
        const sheets = await Promise.all(marks.map((m) => tx.get(col.sessions().doc(m.sessionId))));

        t.docs.forEach((d, i) => tx.create(refs[i], d.data));
        if (key) tx.create(key, { sessionId: refs[0].id, classId: main.classId });
        if (t.type === "student") {
            if (main.active) tx.update(col.classes().doc(main.classId), { rosterVersion: FieldValue.increment(1), expected: FieldValue.increment(1) });
            sheets.forEach((sheet, i) => {
                if (!sheet.exists) return;
                const x = sheet.data();
                const m = marks[i];
                if (x.roster.some((r) => r.id === m.entry.id)) return;
                const roster = [...x.roster, m.entry].sort(byNo);
                const all = m.mark ? { ...(x.marks || {}), [m.entry.id]: m.mark } : x.marks || {};
                tx.update(sheet.ref, { roster, marks: all, counts: countMarks(roster, all), updatedAt: FieldValue.serverTimestamp() });
            });
        }
        tx.delete(ref);
        tx.create(newAudit(), auditEntry(access, "trash.restore", { classId: t.classId, details: { type: t.type, label: t.label } }));
        type = t.type;
    });
    dropCache();
    return { type };
}

// For good: the item, and a sheet's images. What the log says of it stays.
async function purgeTrash(access, id, body) {
    z.object({ confirmed: z.literal(true, { message: "Confirmez la suppression définitive." }) }).parse(body || {});
    let dir = null;
    await db.runTransaction(async (tx) => {
        const { ref, t } = await readTrash(tx, access, id);
        if (t.type === "session") dir = dirOf(t.docs[0].path.split("/").pop());
        tx.delete(ref);
        tx.create(newAudit(), auditEntry(access, "trash.purge", { classId: t.classId, details: { type: t.type, label: t.label } }));
    });
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true });
}

module.exports = { deleteSession, reopenSession, restoreSession, updateSheetStudents, deleteStudent, deleteClass, deleteTimetable, renameEverywhere, deleteNamed, listTrash, restoreTrash, purgeTrash };
