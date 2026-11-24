// Permissions granted by the person in charge of studies (chargée
// pédagogique): leaving a course, or being away for a day or more. Pure.
//
// An absence is justified when a permission in force covers the whole course.
// Nothing is written on the sheets: it is worked out each time, so a
// certificate brought later justifies past absences, a permission cancelled
// no longer does, and the sheets stay as they were validated.
//
// A permission covering part of a course only is shown beside the student:
// whether it excuses an absence is for a person to say.

const { z } = require("zod");
const { isDate, isTime } = require("./config");

const TYPES = Object.freeze({ exit: "Permission de sortie", absence: "Absence justifiée" });
const CATEGORIES = Object.freeze({
    maladie: "Maladie",
    rdv: "Rendez-vous médical",
    famille: "Raison familiale",
    deuil: "Deuil",
    administratif: "Démarche administrative",
    stage: "Stage ou mission",
    autre: "Autre",
});

const PermissionSchema = z
    .object({
        type: z.enum(Object.keys(TYPES)),
        startDate: z.string().refine(isDate, "Date de début invalide."),
        endDate: z.string().refine(isDate, "Date de fin invalide."),
        startTime: z.string().refine(isTime, "Heure de début invalide.").default("00:00"),
        endTime: z.string().refine(isTime, "Heure de fin invalide.").default("23:59"),
        category: z.enum(Object.keys(CATEGORIES), { message: "Choisissez le motif." }),
        details: z.string().trim().max(300).default(""),
        proof: z.boolean().default(false),
        authority: z.string().trim().min(2, "Indiquez qui accorde la permission.").max(100),
    })
    .superRefine((p, ctx) => {
        const bad = (message) => ctx.addIssue({ code: "custom", message });
        if (p.type === "exit" && p.startDate !== p.endDate) bad("Une permission de sortie est pour un seul jour.");
        if (`${p.endDate}T${p.endTime}` <= `${p.startDate}T${p.startTime}`) bad("La fin doit venir après le début.");
        const days = (new Date(`${p.endDate}T00:00:00Z`) - new Date(`${p.startDate}T00:00:00Z`)) / 86400000;
        if (days > 200) bad("Une permission ne peut pas dépasser 200 jours.");
    });

const bounds = (p) => ({ start: `${p.startDate}T${p.startTime}`, end: `${p.endDate}T${p.endTime}` });
const courseBounds = (s) => ({ start: `${s.date}T${s.start}`, end: `${s.date}T${s.end}` });

const overlaps = (p, s) => {
    const c = courseBounds(s);
    return p.start < c.end && c.start < p.end;
};
const coversAll = (p, s) => {
    const c = courseBounds(s);
    return p.start <= c.start && p.end >= c.end;
};

const inForce = (p) => p.status === "active";

// The permissions of a class, by student, for quick look-ups.
function byStudent(permissions) {
    const map = new Map();
    for (const p of permissions) if (inForce(p)) map.set(p.studentId, [...(map.get(p.studentId) || []), p]);
    return map;
}

// The one that counts for a student at a course: one covering all of it, else
// one covering a part. → { permission, full } or null
function permissionAt(index, studentId, session) {
    const mine = (index.get(studentId) || []).filter((p) => overlaps(p, session));
    if (!mine.length) return null;
    const full = mine.find((p) => coversAll(p, session));
    return { permission: full || mine[0], full: !!full };
}

// Whether an absence at this course is justified.
const isJustified = (index, studentId, session) => !!permissionAt(index, studentId, session)?.full;

// How many of a sheet's absences are justified.
function countJustified(session, index) {
    let n = 0;
    for (const r of session.roster) if (session.marks?.[r.id]?.s === "A" && isJustified(index, r.id, session)) n++;
    return n;
}

module.exports = { TYPES, CATEGORIES, PermissionSchema, bounds, overlaps, coversAll, inForce, byStudent, permissionAt, isJustified, countJustified };
