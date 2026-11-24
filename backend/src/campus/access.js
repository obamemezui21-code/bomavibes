const admin = require("../config/firebaseAdmin");
const { hasFullAdminAccess } = require("../config/roles");
const { CONFIG, SESSION } = require("./config");

// Who may use Campus, and what they may do.
//
// Same principle as EDU-CHECK (eduCheck/access.js): the app's own roles
// (users/{uid}.role) are untouched. Campus roles live in campusMembers/{uid}
// { role, org, name, teacherId, canExport, canPermit }, written by the server only — no
// Firestore rule opens that collection.
//
//   admin    the institution's administrator (a full admin of BomaVibes is
//            one too, for CONFIG.defaultOrg);
//   agent    agent pédagogique: creates sessions, enters and validates
//            sheets, reads the whole institution;
//   teacher  reads their own sessions only (teacherId).

const db = admin.firestore();
const ROLES = Object.freeze({ ADMIN: "admin", AGENT: "agent", TEACHER: "teacher" });

async function campusAccess(firebaseUser) {
    const { uid } = firebaseUser;
    const [member, user] = await Promise.all([db.collection("campusMembers").doc(uid).get(), db.collection("users").doc(uid).get()]);
    const m = member.data();
    const account = user.data() || {};
    const email = firebaseUser.email || null;
    const name = m?.name || account.firstName || firebaseUser.name || email || uid;
    if (hasFullAdminAccess(account.role)) {
        return { allowed: true, uid, role: ROLES.ADMIN, org: CONFIG.defaultOrg, name, email, teacherId: null, canExport: true, canPermit: true, appAdmin: true };
    }
    if (m?.org && Object.values(ROLES).includes(m.role) && (m.role !== ROLES.TEACHER || m.teacherId)) {
        return { allowed: true, uid, role: m.role, org: m.org, name, email, teacherId: m.teacherId || null, canExport: m.role === ROLES.ADMIN || m.canExport === true, canPermit: m.role === ROLES.ADMIN || (m.role === ROLES.AGENT && m.canPermit === true), appAdmin: false };
    }
    return { allowed: false, uid, role: null, org: null };
}

const isAdmin = (a) => a.role === ROLES.ADMIN;
// Grants permissions and justifies absences: the administrator, and the agent
// given that right (chargée pédagogique).
const canPermit = (a) => a.canPermit === true;
const isStaff = (a) => a.role === ROLES.ADMIN || a.role === ROLES.AGENT;

function canReadSession(access, session) {
    if (!session || session.org !== access.org) return false;
    return isStaff(access) || (access.role === ROLES.TEACHER && !!access.teacherId && session.teacherId === access.teacherId);
}

const canEnter = (access, session) => isStaff(access) && session.org === access.org && session.status === SESSION.DRAFT;

// After validation: the administrator, or the agent who validated the sheet,
// for a few days.
function canCorrect(access, session, now = Date.now()) {
    if (!session || session.org !== access.org || session.status !== SESSION.VALIDATED) return false;
    if (isAdmin(access)) return true;
    if (access.role !== ROLES.AGENT || session.validatedBy?.uid !== access.uid) return false;
    const at = session.validatedAt?.toMillis?.() ?? 0;
    return now - at <= CONFIG.agentCorrectionDays * 24 * 3600 * 1000;
}

function canCancel(access, session) {
    if (!session || session.org !== access.org || session.status === SESSION.CANCELLED) return false;
    if (isAdmin(access)) return true;
    return access.role === ROLES.AGENT && session.status === SESSION.DRAFT && session.createdBy?.uid === access.uid;
}

// Express middlewares: 403 unless allowed; req.campus = the access.
async function requireCampus(req, res, next) {
    try {
        const access = await campusAccess(req.firebaseUser);
        if (!access.allowed) return res.status(403).json({ message: "BomaVibes Campus est réservé au personnel de l’établissement." });
        req.campus = access;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

const gate = (check, message) => (req, res, next) => (check(req.campus) ? next() : res.status(403).json({ message }));
const requireStaff = gate(isStaff, "Réservé à l’administration et aux agents pédagogiques.");
const requireCampusAdmin = gate(isAdmin, "Réservé à l’administrateur de l’établissement.");

const requirePermit = gate(canPermit, "Réservé à la personne chargée d’accorder les permissions.");

module.exports = { ROLES, campusAccess, isAdmin, isStaff, canPermit, requirePermit, canReadSession, canEnter, canCorrect, canCancel, requireCampus, requireStaff, requireCampusAdmin };
