const { z } = require("zod");
const { HttpError, academicYear, today, isDate } = require("./config");
const { ROLES, isStaff } = require("./access");
const { weekStart } = require("./stats");
const { DEFAULT_PERIODS, TimetableSchema, isMonday, addDays, slotId, slotsOf, sessionOf, withState, localNow, agenda, describeChanges } = require("./timetable");
const { db, col, FieldValue, who, iso, auditEntry, newAudit, getClass, listStudents, classSessions } = require("./store");
const { createSession } = require("./sessionController");

// The weekly timetable: campusTimetables/{classId}_{monday}, one per class and
// week. A draft is seen by the staff only; published, it drives the sheets.

const DRAFT = "draft";
const PUBLISHED = "published";
const timetables = () => db.collection("campusTimetables");
const refOf = (classId, week) => timetables().doc(`${classId}_${week}`);

const WEEK = z.string().refine(isMonday, "La semaine doit commencer un lundi.");
const REASON = z.string().trim().min(3, "Indiquez le motif.").max(200);

// A teacher sees their own courses, and only what is published.
const visible = (access, t) => !!t && t.org === access.org && (t.status === PUBLISHED || isStaff(access));
const ownSlots = (access, slots) => (access.role === ROLES.TEACHER ? slots.filter((s) => s.teacherId === access.teacherId) : slots);

async function read(access, classId, week) {
    const snap = await refOf(classId, week).get();
    const t = snap.exists ? snap.data() : null;
    return visible(access, t) ? t : null;
}

// One week: the timetable, and the state of each course's sheet.
async function getTimetable(access, query) {
    const cls = await getClass(access, query.classId);
    const week = query.week ? WEEK.parse(query.week) : weekStart(today());
    const [t, all] = await Promise.all([read(access, cls.id, week), timetables().where("classId", "==", cls.id).select("org", "week", "status").get()]);
    const weeks = all.docs
        .map((d) => d.data())
        .filter((x) => visible(access, x))
        .map((x) => ({ week: x.week, status: x.status }))
        .sort((a, b) => (a.week < b.week ? 1 : -1));
    const out = { week, weeks, previous: weeks.find((w) => w.week < week)?.week || null, defaultPeriods: DEFAULT_PERIODS, timetable: null };
    if (!t) return out;
    const sessions = await classSessions(cls.id, academicYear(week));
    const now = localNow();
    out.timetable = {
        week: t.week,
        title: t.title,
        note: t.note,
        status: t.status,
        version: t.version,
        periods: t.periods,
        slots: ownSlots(access, slotsOf(t)).map((s) => withState(s, sessions, now)),
        updatedBy: t.updatedBy?.name || "",
        updatedAt: iso(t.updatedAt),
    };
    return out;
}

// Saves a week. Names come from the catalogue, never from the request.
async function saveTimetable(access, body) {
    const data = TimetableSchema.parse(body);
    const cls = await getClass(access, data.classId);
    const ref = refOf(cls.id, data.week);
    await db.runTransaction(async (tx) => {
        const subjectIds = [...new Set(data.slots.map((s) => s.subjectId))];
        const teacherIds = [...new Set(data.slots.map((s) => s.teacherId).filter(Boolean))];
        const [snap, ...docs] = await Promise.all([tx.get(ref), ...subjectIds.map((id) => tx.get(col.subjects().doc(id))), ...teacherIds.map((id) => tx.get(col.teachers().doc(id)))]);
        const names = new Map();
        for (const d of docs) {
            if (!d.exists || d.data().org !== access.org) throw new HttpError(400, "Matière ou enseignant introuvable.");
            names.set(d.ref.path, d.data().name);
        }
        const before = snap.exists ? snap.data() : null;
        if ((before?.version || 0) !== data.version) throw new HttpError(409, "Ce planning vient d’être modifié par quelqu’un d’autre : rechargez la page.", { code: "CHANGED" });
        const old = new Map((before?.slots || []).map((s) => [slotId(s), s]));
        const slots = data.slots.map((s) => {
            const was = old.get(slotId(s));
            return {
                ...s,
                subjectName: names.get(col.subjects().doc(s.subjectId).path),
                teacherName: s.teacherId ? names.get(col.teachers().doc(s.teacherId).path) : null,
                // A cancelled course stays so while it is the same course.
                cancelled: was && was.subjectId === s.subjectId ? was.cancelled || null : null,
            };
        });
        const after = { periods: [...data.periods].sort((a, b) => (a.start < b.start ? -1 : 1)), slots, title: data.title, note: data.note };
        tx.set(ref, {
            org: access.org,
            classId: cls.id,
            week: data.week,
            ...after,
            status: before?.status || DRAFT,
            version: data.version + 1,
            createdBy: before?.createdBy || who(access),
            updatedBy: who(access),
            updatedAt: FieldValue.serverTimestamp(),
        });
        const changes = describeChanges(before, after);
        if (changes.length) tx.create(newAudit(), auditEntry(access, "timetable.save", { classId: cls.id, week: data.week, details: { changes } }));
    });
    return { version: data.version + 1 };
}

async function setStatus(access, body) {
    const { classId, week, published } = z.object({ classId: z.string(), week: WEEK, published: z.boolean() }).parse(body);
    const cls = await getClass(access, classId);
    const ref = refOf(cls.id, week);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const t = snap.data();
        if (!t || t.org !== access.org) throw new HttpError(404, "Planning introuvable.");
        if (published && !t.slots.length) throw new HttpError(400, "Ce planning est vide.");
        const status = published ? PUBLISHED : DRAFT;
        if (t.status === status) return;
        tx.update(ref, { status, version: t.version + 1, updatedBy: who(access), updatedAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, published ? "timetable.publish" : "timetable.unpublish", { classId: cls.id, week }));
    });
}

// A new week from another: same courses. An evaluation or a cancellation was
// for that week only.
async function copyTimetable(access, body) {
    const { classId, from, to } = z.object({ classId: z.string(), from: WEEK, to: WEEK }).parse(body);
    const cls = await getClass(access, classId);
    await db.runTransaction(async (tx) => {
        const [source, target] = await Promise.all([tx.get(refOf(cls.id, from)), tx.get(refOf(cls.id, to))]);
        const t = source.data();
        if (!t || t.org !== access.org) throw new HttpError(404, "Planning introuvable.");
        if (target.exists) throw new HttpError(409, "Cette semaine a déjà un planning.");
        tx.create(target.ref, {
            org: access.org,
            classId: cls.id,
            week: to,
            title: t.title,
            note: t.note,
            periods: t.periods,
            slots: t.slots.map((s) => ({ ...s, kind: "course", cancelled: null })),
            status: DRAFT,
            version: 1,
            createdBy: who(access),
            updatedBy: who(access),
            updatedAt: FieldValue.serverTimestamp(),
        });
        tx.create(newAudit(), auditEntry(access, "timetable.copy", { classId: cls.id, week: to, details: { from } }));
    });
}

// A course that did not take place (reason), or does after all (null): it is
// then no longer a missing sheet.
async function cancelSlot(access, body) {
    const d = z.object({ classId: z.string(), week: WEEK, slotId: z.string(), reason: REASON.nullable() }).parse(body);
    const cls = await getClass(access, d.classId);
    const sessions = await classSessions(cls.id, academicYear(d.week));
    const ref = refOf(cls.id, d.week);
    await db.runTransaction(async (tx) => {
        const t = (await tx.get(ref)).data();
        const slot = t && t.org === access.org && slotsOf(t).find((s) => s.id === d.slotId);
        if (!slot) throw new HttpError(404, "Cours introuvable.");
        const session = d.reason ? sessionOf(slot, sessions) : null;
        if (session) throw new HttpError(409, "Une feuille existe pour ce cours : annulez d’abord la feuille.", { sessionId: session.id });
        const slots = t.slots.map((s) => (slotId(s) === d.slotId ? { ...s, cancelled: d.reason ? { reason: d.reason, by: access.name, at: new Date().toISOString() } : null } : s));
        tx.update(ref, { slots, version: t.version + 1, updatedBy: who(access), updatedAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, d.reason ? "slot.cancel" : "slot.restore", { classId: cls.id, week: d.week, details: { course: slot.subjectName, date: slot.date, start: slot.start }, reason: d.reason }));
    });
}

// The sheet of a course: the one it has, or a new one ready to be filled in.
async function openOne(access, cls, slot, { teacherId, force } = {}) {
    const existing = sessionOf(slot, await classSessions(cls.id, academicYear(slot.date)));
    if (existing) return { id: existing.id, created: false };
    if (slot.cancelled) throw new HttpError(409, "Ce cours est marqué comme annulé.");
    const teacher = slot.teacherId || teacherId;
    if (!teacher) throw new HttpError(400, "Indiquez l’enseignant de ce cours.", { code: "TEACHER" });
    try {
        const { id } = await createSession(access, { classId: cls.id, date: slot.date, start: slot.start, end: slot.end, subjectId: slot.subjectId, teacherId: teacher, kind: slot.kind, force });
        return { id, created: true };
    } catch (err) {
        // Opened by someone else at the same moment: theirs.
        if (err instanceof HttpError && err.extra.code === "DUPLICATE") return { id: err.extra.sessionId, created: false };
        throw err;
    }
}

async function publishedWeek(access, classId, week) {
    const cls = await getClass(access, classId);
    const t = await read(access, cls.id, week);
    if (!t) throw new HttpError(404, "Planning introuvable.");
    if (t.status !== PUBLISHED) throw new HttpError(409, "Publiez d’abord ce planning.");
    return { cls, t };
}

async function openSlot(access, body) {
    const d = z.object({ classId: z.string(), week: WEEK, slotId: z.string(), teacherId: z.string().optional(), force: z.boolean().default(false) }).parse(body);
    const { cls, t } = await publishedWeek(access, d.classId, d.week);
    const slot = slotsOf(t).find((s) => s.id === d.slotId);
    if (!slot) throw new HttpError(404, "Cours introuvable.");
    return openOne(access, cls, slot, d);
}

// Every sheet of a day at once.
async function openDay(access, body) {
    const { classId, date } = z.object({ classId: z.string(), date: z.string().refine(isDate, "Date invalide.") }).parse(body);
    const { cls, t } = await publishedWeek(access, classId, weekStart(date));
    const out = { created: 0, existing: 0, skipped: [] };
    for (const slot of slotsOf(t).filter((s) => s.date === date && !s.cancelled)) {
        try {
            const { created } = await openOne(access, cls, slot);
            if (created) out.created++;
            else out.existing++;
        } catch (err) {
            if (!(err instanceof HttpError)) throw err;
            out.skipped.push({ slotId: slot.id, subjectName: slot.subjectName, start: slot.start, message: err.message });
        }
    }
    return out;
}

// The dashboard's « aujourd'hui »: this week and the three before.
async function getAgenda(access, query) {
    const cls = await getClass(access, query.classId);
    const now = localNow();
    const week = weekStart(now.date);
    const refs = [7, 0, -7, -14, -21].map((n) => refOf(cls.id, addDays(week, n)));
    const [snaps, sessions] = await Promise.all([db.getAll(...refs), classSessions(cls.id, academicYear(now.date))]);
    const docs = snaps.map((s) => s.data()).filter((t) => t && visible(access, t));
    const published = docs.filter((t) => t.status === PUBLISHED).map((t) => ({ ...t, slots: ownSlots(access, t.slots) }));
    const mine = docs.find((t) => t.week === week);
    return { now, weekStatus: mine ? mine.status : null, ...agenda(published, sessions, now) };
}

// Blank paper sheets of a day, or of the whole week (without creating them).
async function blankSheets(access, query) {
    const d = z.object({ classId: z.string(), week: WEEK, date: z.string().refine(isDate).optional() }).parse(query);
    const cls = await getClass(access, d.classId);
    const t = await read(access, cls.id, d.week);
    if (!t) throw new HttpError(404, "Planning introuvable.");
    const roster = (await listStudents(cls.id)).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, no: s.importNo ?? null }));
    return {
        classLabel: cls.label,
        sessions: slotsOf(t)
            .filter((s) => !s.cancelled && (!d.date || s.date === d.date))
            .map((s) => ({ org: cls.org, classCode: cls.code, date: s.date, start: s.start, end: s.end, subjectName: s.subjectName, teacherName: s.teacherName || "", kind: s.kind, periodLabel: s.periodLabel })),
        roster,
    };
}

module.exports = { getTimetable, saveTimetable, setStatus, copyTimetable, cancelSlot, openSlot, openDay, getAgenda, blankSheets };
