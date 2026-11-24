const admin = require("../config/firebaseAdmin");
const { HttpError, SESSION } = require("./config");

// Firestore access shared by the Campus controllers.
//
// Collections (Admin SDK only: no client rule opens any of them):
//   campusMembers/{uid}        role, org, name, teacherId, canExport
//   campusClasses/{org-code}   org, code, label, expected, rosterVersion
//   campusStudents/{ETU-…}     org, classId, name, importNo, active, nameHistory
//   campusImports/{id}         one import of a list: who, when, report, changes
//   campusSubjects/{id}        org, name, active
//   campusTeachers/{id}        org, name, active
//   campusSessions/{id}        one course session and its sheet: details,
//                              roster (as it was), marks {studentId: {s,n,u,t}}
//   campusSessionKeys/{hash}   one per class + date + subject + start time:
//                              makes a second sheet for a session impossible
//   campusTimetables/{id}      the timetable of a class for a week
//   campusTrash/{id}           what the administrator deleted, to be restored
//   campusAudit/{id}           every change, kept for ever
//
// A whole sheet is one document (119 students ≈ 25 KB): it is read in one
// read, and every change to it is a transaction.

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const col = {
    members: () => db.collection("campusMembers"),
    classes: () => db.collection("campusClasses"),
    students: () => db.collection("campusStudents"),
    imports: () => db.collection("campusImports"),
    subjects: () => db.collection("campusSubjects"),
    teachers: () => db.collection("campusTeachers"),
    sessions: () => db.collection("campusSessions"),
    keys: () => db.collection("campusSessionKeys"),
    audit: () => db.collection("campusAudit"),
};

const who = (access) => ({ uid: access.uid, name: access.name });
const iso = (t) => t?.toDate?.().toISOString() ?? null;

// The audit entry of a change, to be written in the same transaction or
// batch as the change itself (tx.create / batch.create).
function auditEntry(access, action, data = {}) {
    return { org: access.org, action, by: { ...who(access), email: access.email || null }, at: FieldValue.serverTimestamp(), ...data };
}
const newAudit = () => col.audit().doc();

function publicAudit(doc) {
    const d = doc.data();
    return { id: doc.id, ...d, by: { name: d.by?.name || "", uid: d.by?.uid || "" }, at: iso(d.at) };
}

async function getClass(access, classId) {
    const snap = await col.classes().doc(String(classId || "-")).get();
    if (!snap.exists || snap.data().org !== access.org) throw new HttpError(404, "Classe introuvable.");
    return { id: snap.id, ...snap.data() };
}

async function listStudents(classId) {
    const snap = await col.students().where("classId", "==", classId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.importNo ?? 1e9) - (b.importNo ?? 1e9) || a.name.localeCompare(b.name, "fr"));
}

// The sessions of a class for a year, kept in memory for a minute: the
// dashboard, the lists and the reports read the same ones. One API process
// (pm2), and every write here drops them.
const CACHE_MS = 60 * 1000;
const cache = new Map();
let generation = 0;

async function classSessions(classId, year = null) {
    const key = `${classId}|${year || "all"}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
    let query = col.sessions().where("classId", "==", classId);
    if (year) query = query.where("year", "==", year);
    const before = generation;
    const snap = await query.get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Not kept if something was written while it was being read.
    if (before === generation) cache.set(key, { at: Date.now(), rows });
    return rows;
}

function dropCache(classId) {
    generation++;
    for (const key of cache.keys()) if (!classId || key.startsWith(`${classId}|`)) cache.delete(key);
}

// What the app is sent of a session; the marks only when asked for.
function publicSession(s, { full = false } = {}) {
    const out = {
        id: s.id,
        classId: s.classId,
        classCode: s.classCode,
        org: s.org,
        year: s.year,
        date: s.date,
        start: s.start,
        end: s.end,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
        kind: s.kind || "course",
        status: s.status,
        counts: s.counts,
        expected: s.roster.length,
        agentName: s.agent?.name || s.createdBy?.name || "",
        createdBy: s.createdBy?.name || "",
        createdAt: iso(s.createdAt),
        updatedAt: iso(s.updatedAt),
        validatedBy: s.validatedBy?.name || null,
        validatedAt: iso(s.validatedAt),
        cancelledBy: s.cancelledBy?.name || null,
        cancelledAt: iso(s.cancelledAt),
        cancelReason: s.cancelReason || null,
        corrections: s.corrections || 0,
        scans: (s.scans || []).map((x) => ({ id: x.id, kind: x.kind, name: x.name, by: x.by?.name || "", at: x.at })),
    };
    if (!full) return out;
    out.rosterVersion = s.rosterVersion || 0;
    out.roster = s.roster;
    out.marks = Object.fromEntries(Object.entries(s.marks || {}).map(([id, m]) => [id, { s: m.s ?? null, n: m.n || "", ...(m.auto ? { auto: true } : {}) }]));
    return out;
}

const isOpen = (s) => s.status !== SESSION.CANCELLED;

module.exports = { db, col, FieldValue, Timestamp, who, iso, auditEntry, newAudit, publicAudit, getClass, listStudents, classSessions, dropCache, publicSession, isOpen };
