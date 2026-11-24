const crypto = require("crypto");
const { z } = require("zod");
const admin = require("../config/firebaseAdmin");
const { HttpError, nameKey, academicYear, today } = require("./config");
const { ROLES, isAdmin, isStaff } = require("./access");
const { db, col, FieldValue, who, iso, auditEntry, newAudit, publicAudit } = require("./store");

// Subjects, teachers, staff accounts and the log.

const NAME = z.string().trim().min(2, "Nom trop court.").max(100, "Nom trop long.");
const KINDS = { subjects: "subject", teachers: "teacher" };

// What every screen needs first.
async function bootstrap(access) {
    const byOrg = async (c) => (await c.where("org", "==", access.org).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const [classes, subjects, teachers] = await Promise.all([byOrg(col.classes()), byOrg(col.subjects()), byOrg(col.teachers())]);
    const tidy = (list) => list.map((x) => ({ id: x.id, name: x.name, active: x.active !== false })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
        org: access.org,
        me: { uid: access.uid, name: access.name, role: access.role, teacherId: access.teacherId, canExport: access.canExport, admin: isAdmin(access), staff: isStaff(access), appAdmin: access.appAdmin },
        year: academicYear(today()),
        today: today(),
        classes: classes.map((c) => ({ id: c.id, code: c.code, label: c.label, expected: c.expected, rosterVersion: c.rosterVersion || 0 })).sort((a, b) => a.code.localeCompare(b.code, "fr")),
        subjects: tidy(subjects),
        teachers: tidy(access.role === ROLES.TEACHER ? teachers.filter((t) => t.id === access.teacherId) : teachers),
    };
}

// A subject or teacher is the same one whatever its accents and capitals: the
// identifier comes from the name, so it can't be added twice.
async function addNamed(access, kind, body) {
    const { name } = z.object({ name: NAME }).parse(body);
    const base = crypto.createHash("sha1").update(`${access.org}|${kind}|${nameKey(name)}`).digest("hex").slice(0, 20);
    let ref;
    await db.runTransaction(async (tx) => {
        const all = await tx.get(col[kind]().where("org", "==", access.org));
        const same = all.docs.find((d) => nameKey(d.data().name) === nameKey(name));
        if (same) {
            ref = same.ref;
            if (same.data().active === false) tx.update(ref, { active: true });
            return;
        }
        // Taken by one that was renamed since: a new identifier.
        ref = all.docs.some((d) => d.id === base) ? col[kind]().doc() : col[kind]().doc(base);
        tx.create(ref, { org: access.org, name: name.normalize("NFC"), active: true, createdBy: who(access), createdAt: FieldValue.serverTimestamp() });
        tx.create(newAudit(), auditEntry(access, `${KINDS[kind]}.add`, { targetId: ref.id, details: { name } }));
    });
    return { id: ref.id, name: (await ref.get()).data().name };
}

// Renaming changes the catalogue and the sheets to come; the sheets already
// made keep the name they were made with.
async function updateNamed(access, kind, id, body) {
    const data = z.object({ name: NAME.optional(), active: z.boolean().optional() }).parse(body);
    const ref = col[kind]().doc(id);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data().org !== access.org) throw new HttpError(404, "Introuvable.");
        const old = snap.data();
        tx.update(ref, data);
        tx.create(newAudit(), auditEntry(access, `${KINDS[kind]}.update`, { targetId: id, from: { name: old.name, active: old.active !== false }, to: data }));
    });
}

async function listMembers(access) {
    const snap = await col.members().where("org", "==", access.org).get();
    return snap.docs
        .map((d) => {
            const m = d.data();
            return { uid: d.id, email: m.email, name: m.name, role: m.role, teacherId: m.teacherId || null, canExport: m.canExport === true, grantedBy: m.grantedBy?.name || "", grantedAt: iso(m.grantedAt) };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const MemberSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide.")),
    role: z.enum(Object.values(ROLES)),
    name: NAME,
    teacherId: z.string().nullable().optional(),
    canExport: z.boolean().default(false),
});

async function setMember(access, body) {
    const d = MemberSchema.parse(body);
    // Only an admin of BomaVibes itself may appoint an institution's administrator.
    if (d.role === ROLES.ADMIN && !access.appAdmin) throw new HttpError(403, "Seul un administrateur BomaVibes peut nommer un administrateur de l’établissement.");
    if (d.role === ROLES.TEACHER) {
        const t = d.teacherId ? await col.teachers().doc(d.teacherId).get() : null;
        if (!t?.exists || t.data().org !== access.org) throw new HttpError(400, "Choisissez l’enseignant correspondant à ce compte.");
    }
    let user;
    try {
        user = await admin.auth().getUserByEmail(d.email);
    } catch (err) {
        if (err.code === "auth/user-not-found") throw new HttpError(404, "Aucun compte BomaVibes avec cette adresse. La personne doit d’abord s’inscrire.");
        throw err;
    }
    // An unverified address may have been typed by anyone.
    if (!user.emailVerified) throw new HttpError(400, "Cette personne doit d’abord vérifier son adresse e-mail.");
    const ref = col.members().doc(user.uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.data();
        if (old && old.org !== access.org) throw new HttpError(409, "Ce compte appartient déjà à un autre établissement.");
        if (old?.role === ROLES.ADMIN && !access.appAdmin) throw new HttpError(403, "Seul un administrateur BomaVibes peut modifier ce compte.");
        tx.set(ref, {
            org: access.org,
            email: d.email,
            name: d.name,
            role: d.role,
            teacherId: d.role === ROLES.TEACHER ? d.teacherId : null,
            canExport: d.role === ROLES.ADMIN || d.canExport,
            grantedBy: who(access),
            grantedAt: FieldValue.serverTimestamp(),
        });
        tx.create(newAudit(), auditEntry(access, "member.set", { targetId: user.uid, from: old ? { role: old.role, name: old.name, canExport: !!old.canExport } : null, to: { role: d.role, name: d.name, canExport: d.canExport } }));
    });
    return { uid: user.uid };
}

async function removeMember(access, uid) {
    const ref = col.members().doc(uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const m = snap.data();
        if (!m || m.org !== access.org) throw new HttpError(404, "Compte introuvable.");
        if (m.role === ROLES.ADMIN && !access.appAdmin) throw new HttpError(403, "Seul un administrateur BomaVibes peut retirer ce compte.");
        tx.delete(ref);
        tx.create(newAudit(), auditEntry(access, "member.remove", { targetId: uid, from: { role: m.role, name: m.name } }));
    });
}

async function listAudit(access) {
    const snap = await col.audit().orderBy("at", "desc").limit(300).get();
    return snap.docs.filter((d) => d.data().org === access.org).map(publicAudit);
}

module.exports = { bootstrap, addNamed, updateNamed, listMembers, setMember, removeMember, listAudit };
