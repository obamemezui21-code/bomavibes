const admin = require("../config/firebaseAdmin");
const { SUPER_ADMIN_EMAIL, ROLES, isSuperAdminRole } = require("../config/roles");

const db = admin.firestore();
const USERS_LIMIT = 200;

async function listUsers(req, res) {
    try {
        const snap = await db.collection("users").limit(USERS_LIMIT).get();
        const users = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                uid: docSnap.id,
                email: data.email ?? null,
                firstName: data.firstName ?? null,
                role: data.role || ROLES.USER,
                onboarded: !!data.onboarded,
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
    // roles.js. Only promote to ADMIN or demote back to USER here.
    if (role !== ROLES.ADMIN && role !== ROLES.USER) {
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
        res.json({ message: "Rôle mis à jour", uid, role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { listUsers, updateUserRole };
