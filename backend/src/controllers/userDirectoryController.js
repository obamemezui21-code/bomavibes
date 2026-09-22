const admin = require("../config/firebaseAdmin");
const { SUPER_ADMIN_EMAIL, ROLES, isSuperAdminRole } = require("../config/roles");
const { eraseAccount } = require("../services/accountDeletionService");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();

// The general user-management section ("Utilisateurs") reads a capped,
// most-recent-first page of the users collection and filters/searches it in
// memory — same trade-off as contentService.js and adminController's report
// listing. Real cursor pagination would need composite indexes per filter
// (banned/deleted/verified all live on different docs/collections), which
// isn't worth it before this app actually has thousands of users.
const DIRECTORY_CAP = 300;
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // "active" = seen in the last 30 days

function toIso(ts) {
    return ts?.toDate?.().toISOString() ?? null;
}

async function fetchDirectoryPage() {
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(DIRECTORY_CAP).get();
    const uids = snap.docs.map((docSnap) => docSnap.id);
    const profileDocs = uids.length
        ? await db.getAll(...uids.map((uid) => db.collection("profiles").doc(uid)))
        : [];
    const profilesByUid = new Map(profileDocs.map((docSnap) => [docSnap.id, docSnap.data()]));
    const now = Date.now();

    return snap.docs.map((docSnap) => {
        const data = docSnap.data();
        const profile = profilesByUid.get(docSnap.id) || {};
        const lastActiveMs = profile.lastActive?.toMillis?.() ?? null;
        return {
            uid: docSnap.id,
            email: data.email ?? null,
            firstName: data.firstName ?? profile.firstName ?? null,
            photo: profile.photos?.[0] ?? null,
            role: data.role || ROLES.USER,
            onboarded: !!data.onboarded,
            banned: !!data.banned,
            deleted: !!data.deleted,
            verified: !!profile.verified,
            emailVerified: !!data.emailVerified,
            isActive: !!lastActiveMs && now - lastActiveMs < ACTIVE_WINDOW_MS,
            lastActive: lastActiveMs ? new Date(lastActiveMs).toISOString() : null,
            createdAt: toIso(data.createdAt),
        };
    });
}

function applyFilter(users, filter) {
    switch (filter) {
        case "active":
            return users.filter((u) => u.isActive && !u.banned && !u.deleted);
        case "verified":
            return users.filter((u) => u.verified && !u.deleted);
        case "suspended":
            return users.filter((u) => u.banned);
        case "deleted":
            return users.filter((u) => u.deleted);
        default:
            return users.filter((u) => !u.deleted);
    }
}

async function listDirectory(req, res) {
    try {
        const { filter, search } = req.query;
        const page = await fetchDirectoryPage();
        let result = applyFilter(page, filter);

        const q = (search || "").trim().toLowerCase();
        if (q) {
            result = result.filter((u) => u.email?.toLowerCase().includes(q) || u.firstName?.toLowerCase().includes(q));
        }

        res.json({ users: result, cap: DIRECTORY_CAP });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function getDirectoryUser(req, res) {
    const { uid } = req.params;
    try {
        const [userSnap, profileSnap, matchesCount, reportsCount] = await Promise.all([
            db.collection("users").doc(uid).get(),
            db.collection("profiles").doc(uid).get(),
            db.collection("matches").where("users", "array-contains", uid).count().get(),
            db.collection("reports").where("reportedUserId", "==", uid).count().get(),
        ]);

        if (!userSnap.exists) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const data = userSnap.data();
        const profile = profileSnap.exists ? profileSnap.data() : {};

        res.json({
            user: {
                uid,
                email: data.email ?? null,
                firstName: data.firstName ?? profile.firstName ?? null,
                photo: profile.photos?.[0] ?? null,
                role: data.role || ROLES.USER,
                onboarded: !!data.onboarded,
                banned: !!data.banned,
                deleted: !!data.deleted,
                verified: !!profile.verified,
                emailVerified: !!data.emailVerified,
                bio: profile.bio ?? null,
                lastActive: toIso(profile.lastActive),
                createdAt: toIso(data.createdAt),
                deletedAt: toIso(data.deletedAt),
                matchesCount: matchesCount.data().count,
                reportsCount: reportsCount.data().count,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// Admin-initiated version of DELETE /api/account — same eraseAccount(), but
// targeting someone else's uid. Only ever allowed against ROLES.USER, same
// guard as setUserBanned: an Admin/Super Admin must be demoted first.
async function deleteDirectoryUser(req, res) {
    const { uid } = req.params;
    try {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const data = snap.data();
        if (data.deleted) {
            return res.status(400).json({ message: "Ce compte est déjà supprimé" });
        }
        const role = data.role || ROLES.USER;
        if (role !== ROLES.USER || data.email === SUPER_ADMIN_EMAIL || isSuperAdminRole(role)) {
            return res.status(403).json({ message: "Impossible de supprimer un administrateur" });
        }

        await eraseAccount(uid);
        await logAdminAction(req, { action: "DELETE_USER_ACCOUNT", targetType: "user", targetId: uid, metadata: { email: data.email } });

        res.json({ message: "Compte supprimé" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer ce compte" });
    }
}

module.exports = { listDirectory, getDirectoryUser, deleteDirectoryUser };
