const admin = require("../config/firebaseAdmin");
const { hasFullAdminAccess } = require("../config/roles");

// Who may use EDU-CHECK, and what they may see.
//
// Roles live in eduCheckMembers/{uid} { role, org, grantedBy, grantedAt },
// written only by scripts/setEduRole.js (Admin SDK): no Firestore rule opens
// that collection, so a member can never grant themselves a role. (Not on
// users/{uid}: members may write their own fields there.)
//
//   teacher  sees and deletes only their own analyses;
//   lead     (chargé pédagogique / responsable d'établissement) also sees and
//            deletes those of their institution (same org);
//   a full admin of BomaVibes may use it as a teacher (own analyses only:
//            being an admin of the app gives no right to read teachers' work).

const db = admin.firestore();
const ROLES = Object.freeze({ TEACHER: "teacher", LEAD: "lead" });

async function eduAccess(uid) {
    const [member, user] = await Promise.all([db.collection("eduCheckMembers").doc(uid).get(), db.collection("users").doc(uid).get()]);
    const m = member.data();
    if (m && Object.values(ROLES).includes(m.role)) return { allowed: true, uid, role: m.role, org: m.org || null };
    if (hasFullAdminAccess(user.data()?.role)) return { allowed: true, uid, role: ROLES.TEACHER, org: null, viaAdmin: true };
    return { allowed: false, uid, role: null, org: null };
}

function canRead(access, analysis) {
    if (!analysis) return false;
    if (analysis.ownerUid === access.uid) return true;
    return access.role === ROLES.LEAD && !!access.org && analysis.org === access.org;
}

// Same as reading: a lead can remove their institution's analyses.
const canDelete = canRead;

// Express middleware: 403 unless allowed; req.edu = the access.
async function requireEduAccess(req, res, next) {
    try {
        const access = await eduAccess(req.firebaseUser.uid);
        if (!access.allowed) {
            return res.status(403).json({ message: "EDU-CHECK est réservé aux enseignants et responsables pédagogiques autorisés." });
        }
        req.edu = access;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { ROLES, eduAccess, canRead, canDelete, requireEduAccess };
