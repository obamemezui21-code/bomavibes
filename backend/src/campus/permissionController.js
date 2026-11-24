const { z } = require("zod");
const { HttpError, SESSION } = require("./config");
const { isStaff, canPermit } = require("./access");
const { CATEGORIES, TYPES, PermissionSchema, bounds, coversAll, inForce, overlaps } = require("./permissions");
const { db, col, FieldValue, who, iso, auditEntry, newAudit, getClass, classSessions, classPermissions, dropCache, isOpen } = require("./store");

// Permissions and justified absences (campusPermissions). Granted by the
// administrator, or an account given that right (chargée pédagogique). The
// agents see who may be away; the details are for those who grant.

const REASON = z.string().trim().min(3, "Indiquez le motif.").max(300);

function publicPermission(p, access) {
    const own = canPermit(access);
    return {
        id: p.id,
        studentId: p.studentId,
        studentName: p.studentName,
        type: p.type,
        start: p.start,
        end: p.end,
        category: p.category,
        proof: !!p.proof,
        authority: p.authority,
        status: p.status,
        details: own ? p.details || "" : "",
        cancelReason: own ? p.cancelReason || "" : "",
        by: p.by?.name || "",
        at: iso(p.at),
    };
}

// filters: studentId, from, to (dates), status
async function listPermissions(access, query) {
    if (!isStaff(access)) throw new HttpError(403, "Réservé à l’administration et aux agents pédagogiques.");
    const cls = await getClass(access, query.classId);
    const all = await classPermissions(cls.id);
    return all
        .filter((p) => (!query.studentId || p.studentId === query.studentId) && (!query.from || p.end >= `${query.from}T00:00`) && (!query.to || p.start <= `${query.to}T23:59`) && (!query.status || p.status === query.status))
        .sort((a, b) => (a.start < b.start ? 1 : -1))
        .map((p) => publicPermission(p, access));
}

// The absences a permission would justify: marked « absent », course wholly
// inside, not already justified.
async function affectedAbsences(classId, studentId, period) {
    const [sessions, all] = await Promise.all([classSessions(classId), classPermissions(classId)]);
    const others = all.filter((p) => inForce(p) && p.studentId === studentId);
    return sessions
        .filter((s) => isOpen(s) && s.marks?.[studentId]?.s === "A" && coversAll(period, s) && !others.some((p) => coversAll(p, s)))
        .sort((a, b) => (`${a.date}${a.start}` < `${b.date}${b.start}` ? -1 : 1))
        .map((s) => ({ sessionId: s.id, date: s.date, start: s.start, end: s.end, subjectName: s.subjectName, validated: s.status === SESSION.VALIDATED }));
}

// Courses the period touches without covering: said, so that nobody believes
// they are excused.
async function partialCourses(classId, studentId, period) {
    const sessions = await classSessions(classId);
    return sessions
        .filter((s) => isOpen(s) && s.roster.some((r) => r.id === studentId) && overlaps(period, s) && !coversAll(period, s))
        .map((s) => ({ date: s.date, start: s.start, end: s.end, subjectName: s.subjectName }));
}

async function createPermission(access, body) {
    const data = PermissionSchema.parse(body);
    const { studentId, dryRun } = z.object({ studentId: z.string().min(1, "Choisissez l’étudiant."), dryRun: z.boolean().default(false) }).parse(body);
    const snap = await col.students().doc(studentId).get();
    const s = snap.data();
    if (!s || s.org !== access.org) throw new HttpError(404, "Étudiant introuvable.");
    const period = bounds(data);
    const affected = await affectedAbsences(s.classId, studentId, period);
    if (dryRun) return { affected, partial: await partialCourses(s.classId, studentId, period) };

    const ref = col.permissions().doc();
    const batch = db.batch();
    batch.create(ref, {
        org: access.org,
        classId: s.classId,
        studentId,
        studentName: s.name,
        type: data.type,
        ...period,
        category: data.category,
        details: data.details,
        proof: data.proof,
        authority: data.authority,
        status: "active",
        by: who(access),
        at: FieldValue.serverTimestamp(),
    });
    // The log keeps the kind of reason, not what was confided.
    batch.create(newAudit(), auditEntry(access, "permission.create", { classId: s.classId, studentId, studentName: s.name, details: { type: TYPES[data.type], ...period, category: CATEGORIES[data.category], authority: data.authority, justified: affected.length } }));
    await batch.commit();
    dropCache(s.classId);
    return { id: ref.id, affected };
}

async function readPermission(tx, access, id) {
    const ref = col.permissions().doc(id);
    const snap = await tx.get(ref);
    const p = snap.data();
    if (!p || p.org !== access.org) throw new HttpError(404, "Permission introuvable.");
    return { ref, p };
}

async function updatePermission(access, id, body) {
    const data = PermissionSchema.parse(body);
    const { reason } = z.object({ reason: REASON }).parse(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, p } = await readPermission(tx, access, id);
        if (!inForce(p)) throw new HttpError(409, "Cette permission est annulée.");
        const period = bounds(data);
        tx.update(ref, { type: data.type, ...period, category: data.category, details: data.details, proof: data.proof, authority: data.authority, updatedBy: who(access), updatedAt: FieldValue.serverTimestamp() });
        tx.create(
            newAudit(),
            auditEntry(access, "permission.update", {
                classId: p.classId,
                studentId: p.studentId,
                studentName: p.studentName,
                from: { type: TYPES[p.type], start: p.start, end: p.end, category: CATEGORIES[p.category], proof: !!p.proof },
                to: { type: TYPES[data.type], ...period, category: CATEGORIES[data.category], proof: data.proof },
                reason,
            }),
        );
        classId = p.classId;
    });
    dropCache(classId);
}

// Never deleted: cancelled, with a reason. The absences it justified no
// longer are.
async function cancelPermission(access, id, body) {
    const { reason } = z.object({ reason: REASON }).parse(body);
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, p } = await readPermission(tx, access, id);
        if (!inForce(p)) throw new HttpError(409, "Cette permission est déjà annulée.");
        tx.update(ref, { status: "cancelled", cancelReason: reason, cancelledBy: who(access), cancelledAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, "permission.cancel", { classId: p.classId, studentId: p.studentId, studentName: p.studentName, details: { type: TYPES[p.type], start: p.start, end: p.end }, reason }));
        classId = p.classId;
    });
    dropCache(classId);
}

module.exports = { listPermissions, createPermission, updatePermission, cancelPermission, publicPermission };
