const admin = require("../config/firebaseAdmin");
const { SUPER_ADMIN_EMAIL, ROLES, isSuperAdminRole } = require("../config/roles");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();
const USERS_LIMIT = 200;
const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.MODERATOR, ROLES.EDITOR, ROLES.USER];

async function listUsers(req, res) {
    try {
        const snap = await db.collection("users").limit(USERS_LIMIT).get();
        const users = snap.docs
            .filter((docSnap) => !docSnap.data().deleted)
            .map((docSnap) => {
                const data = docSnap.data();
                return {
                    uid: docSnap.id,
                    email: data.email ?? null,
                    firstName: data.firstName ?? null,
                    role: data.role || ROLES.USER,
                    onboarded: !!data.onboarded,
                    banned: !!data.banned,
                };
            });
        res.json({ users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function updateUserRole(req, res) {
    const { uid } = req.params;
    const { role } = req.body;

    // ROLES.SUPER_ADMIN is never assignable through this endpoint — see
    // roles.js.
    if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
    }

    try {
        const ref = db.collection("users").doc(uid);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const targetData = snap.data();
        if (isSuperAdminRole(targetData.role) || targetData.email === SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ message: "Impossible de modifier le Super Admin" });
        }

        await ref.update({ role });

        await logAdminAction(req, { action: "UPDATE_USER_ROLE", targetType: "user", targetId: uid, metadata: { role, previousRole: targetData.role || ROLES.USER } });

        res.json({ message: "Rôle mis à jour", uid, role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// Bans/unbans a regular user: disables their Firebase Auth account (blocks
// future sign-ins) and revokes their current refresh tokens (kicks out any
// already-open session next time it refreshes its ID token), then mirrors
// the flag on their Firestore doc so the admin UI can show it. Deliberately
// only ever targets ROLES.USER — an Admin/Super Admin must be demoted to
// USER first (see updateUserRole), so this can never be used to lock out
// another admin.
async function setUserBanned(req, res) {
    const { uid } = req.params;
    const { banned } = req.body;

    if (typeof banned !== "boolean") {
        return res.status(400).json({ message: "Paramètre invalide" });
    }

    try {
        const ref = db.collection("users").doc(uid);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const targetData = snap.data();
        const targetRole = targetData.role || ROLES.USER;
        if (targetRole !== ROLES.USER || targetData.email === SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ message: "Impossible de bannir un administrateur" });
        }

        await admin.auth().updateUser(uid, { disabled: banned });
        if (banned) {
            await admin.auth().revokeRefreshTokens(uid);
        }

        await ref.update({
            banned,
            bannedAt: banned ? admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.delete(),
            bannedBy: banned ? req.firebaseUser.uid : admin.firestore.FieldValue.delete(),
        });

        await logAdminAction(req, { action: banned ? "BAN_USER" : "UNBAN_USER", targetType: "user", targetId: uid });

        res.json({ message: banned ? "Utilisateur banni" : "Utilisateur réactivé", uid, banned });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { listUsers, updateUserRole, setUserBanned };
