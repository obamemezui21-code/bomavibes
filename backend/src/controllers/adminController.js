const admin = require("../config/firebaseAdmin");
const { logAdminAction, listAdminLogs } = require("../services/adminLogService");

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

        // A report against a post/comment carries contextRef.postId (see
        // firebase/safety.js) — fetch those posts too so the admin can see
        // and act on the actual content, not just the report metadata.
        const postIds = [...new Set(reports.map((r) => r.contextRef?.postId).filter(Boolean))];
        const postDocs = postIds.length
            ? await db.getAll(...postIds.map((id) => db.collection("posts").doc(id)))
            : [];
        const postsById = new Map(postDocs.filter((docSnap) => docSnap.exists).map((docSnap) => [docSnap.id, docSnap.data()]));

        const enriched = reports.map((r) => {
            const postId = r.contextRef?.postId;
            const postData = postId ? postsById.get(postId) : null;
            return {
                ...r,
                createdAt: r.createdAt?.toDate?.().toISOString() ?? null,
                reviewedAt: r.reviewedAt?.toDate?.().toISOString() ?? null,
                reporterEmail: usersById.get(r.reporterId)?.email ?? null,
                reportedUserEmail: usersById.get(r.reportedUserId)?.email ?? null,
                reportedUserBanned: !!usersById.get(r.reportedUserId)?.banned,
                post: postId
                    ? postData
                        ? { id: postId, type: postData.type, text: postData.text ?? null, photoUrl: postData.photoUrl ?? null }
                        : { id: postId, deleted: true }
                    : null,
            };
        });

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

        await logAdminAction(req, { action: "UPDATE_REPORT_STATUS", targetType: "report", targetId: id, metadata: { status } });

        res.json({ message: "Signalement mis à jour" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function deletePost(req, res) {
    const { postId } = req.params;

    try {
        const ref = db.collection("posts").doc(postId);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ message: "Publication introuvable" });
        }

        // Removes the post plus its comments/likes subcollections in one
        // call — Firestore never cascade-deletes those on its own.
        await db.recursiveDelete(ref);

        await logAdminAction(req, { action: "DELETE_POST", targetType: "post", targetId: postId, metadata: { authorId: snap.data().authorId } });

        res.json({ message: "Publication supprimée", postId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

const ACTIVITY_DAYS = 14;

function dayKey(date) {
    return date.toISOString().slice(0, 10);
}

// Buckets each collection's docs (already filtered to the last
// ACTIVITY_DAYS) into one count per calendar day, so the admin overview can
// chart signups/matches/posts over time without a scheduled aggregation job.
function buildDailySeries(buckets) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const days = [];
    const countsByDay = new Map();
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const key = dayKey(d);
        days.push(key);
        countsByDay.set(key, { date: key, signups: 0, matches: 0, posts: 0 });
    }

    for (const [field, docs] of Object.entries(buckets)) {
        for (const docSnap of docs) {
            const createdAt = docSnap.data().createdAt?.toDate?.();
            if (!createdAt) continue;
            const bucket = countsByDay.get(dayKey(createdAt));
            if (bucket) bucket[field] += 1;
        }
    }

    return days.map((key) => countsByDay.get(key));
}

async function getActivitySeries(req, res) {
    try {
        const since = new Date();
        since.setUTCHours(0, 0, 0, 0);
        since.setUTCDate(since.getUTCDate() - (ACTIVITY_DAYS - 1));
        const sinceTs = admin.firestore.Timestamp.fromDate(since);

        const [usersSnap, matchesSnap, postsSnap] = await Promise.all([
            db.collection("users").where("createdAt", ">=", sinceTs).get(),
            db.collection("matches").where("createdAt", ">=", sinceTs).get(),
            db.collection("posts").where("createdAt", ">=", sinceTs).get(),
        ]);

        const series = buildDailySeries({
            signups: usersSnap.docs,
            matches: matchesSnap.docs,
            posts: postsSnap.docs,
        });

        res.json({ days: ACTIVITY_DAYS, series });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function getLogs(req, res) {
    try {
        const logs = await listAdminLogs({ cursor: req.query.cursor });
        res.json({ logs, nextCursor: logs.length === 200 ? logs[logs.length - 1].id : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { getStats, listReports, updateReportStatus, deletePost, getActivitySeries, getLogs };
