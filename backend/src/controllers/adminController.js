const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

const REPORT_STATUSES = ["pending", "reviewed", "dismissed", "actioned"];
const REPORTS_LIMIT = 100;

async function getStats(req, res) {
    try {
        const [usersCount, matchesCount, postsCount, pendingReportsCount] = await Promise.all([
            db.collection("users").count().get(),
            db.collection("matches").count().get(),
            db.collection("posts").count().get(),
            db.collection("reports").where("status", "==", "pending").count().get(),
        ]);

        res.json({
            totalUsers: usersCount.data().count,
            totalMatches: matchesCount.data().count,
            totalPosts: postsCount.data().count,
            pendingReports: pendingReportsCount.data().count,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function listReports(req, res) {
    const status = req.query.status || "pending";
    if (status !== "all" && !REPORT_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Statut invalide" });
    }

    try {
        let reports;
        if (status === "all") {
            const snap = await db.collection("reports").orderBy("createdAt", "desc").limit(REPORTS_LIMIT).get();
            reports = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        } else {
            // where(status) + orderBy(createdAt) needs a composite index, and
            // this repo has no firestore.indexes.json to declare one — sort
            // in memory instead so this works without manual Firebase console setup.
            const snap = await db.collection("reports").where("status", "==", status).limit(500).get();
            reports = snap.docs
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                .slice(0, REPORTS_LIMIT);
        }

        const uids = [...new Set(reports.flatMap((r) => [r.reporterId, r.reportedUserId]).filter(Boolean))];
        const userDocs = uids.length
            ? await db.getAll(...uids.map((uid) => db.collection("users").doc(uid)))
            : [];
        const usersById = new Map(userDocs.map((docSnap) => [docSnap.id, docSnap.data()]));

        const enriched = reports.map((r) => ({
            ...r,
            createdAt: r.createdAt?.toDate?.().toISOString() ?? null,
            reviewedAt: r.reviewedAt?.toDate?.().toISOString() ?? null,
            reporterEmail: usersById.get(r.reporterId)?.email ?? null,
            reportedUserEmail: usersById.get(r.reportedUserId)?.email ?? null,
        }));

        res.json({ reports: enriched });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function updateReportStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;

    if (!REPORT_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Statut invalide" });
    }

    try {
        const ref = db.collection("reports").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ message: "Signalement introuvable" });
        }

        await ref.update({
            status,
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: req.firebaseUser.uid,
        });

        res.json({ message: "Signalement mis à jour" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { getStats, listReports, updateReportStatus };
