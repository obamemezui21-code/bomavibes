// Edit/delete for a single `announcements` doc — kept separate from
// contentService.js's generic CRUD because announcements have no
// draft/published workflow (they're the always-live doc a broadcast created
// with "publier aussi comme annonce interne" checked). The admin_logs
// SEND_NOTIFICATION entry that recorded the original send is never touched
// here — it stays an immutable record of what was actually pushed and when.
const admin = require("../config/firebaseAdmin");
const { logAdminAction } = require("../services/adminLogService");
const { updateAnnouncementFeedPost, deleteFeedPost } = require("../services/systemFeedPostService");

const db = admin.firestore();

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function readFields(body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw badRequest("Titre requis");
    if (title.length > 200) throw badRequest("Titre trop long");

    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) throw badRequest("Message requis");
    if (description.length > 2000) throw badRequest("Message trop long");

    const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.trim() : "";
    const ctaLink = typeof body.ctaLink === "string" ? body.ctaLink.trim() : "";

    return { title, description, ctaLabel: ctaLabel || null, ctaLink: ctaLink || null };
}

async function getAnnouncement(req, res) {
    const { id } = req.params;
    try {
        const snap = await db.collection("announcements").doc(id).get();
        if (!snap.exists) return res.status(404).json({ message: "Annonce introuvable" });
        res.json({ item: { id: snap.id, ...snap.data() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

async function updateAnnouncement(req, res) {
    const { id } = req.params;
    const ref = db.collection("announcements").doc(id);

    try {
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ message: "Annonce introuvable" });

        const data = readFields(req.body || {});
        await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Fire-and-forget: the announcement is already saved: a slow/failed
        // image regeneration shouldn't block the admin's edit from landing.
        const feedPostId = snap.data().feedPostId;
        if (feedPostId) {
            updateAnnouncementFeedPost(feedPostId, { title: data.title, message: data.description }).catch((err) =>
                console.error("Failed to update announcement's Feed post:", err)
            );
        }

        await logAdminAction(req, { action: "UPDATE_ANNOUNCEMENT", targetType: "announcements", targetId: id });
        res.json({ message: "Annonce mise à jour" });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible de mettre à jour l'annonce" });
    }
}

async function deleteAnnouncement(req, res) {
    const { id } = req.params;
    const ref = db.collection("announcements").doc(id);

    try {
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ message: "Annonce introuvable" });

        const feedPostId = snap.data().feedPostId;
        await ref.delete();
        if (feedPostId) {
            deleteFeedPost(feedPostId).catch((err) => console.error("Failed to delete announcement's Feed post:", err));
        }

        await logAdminAction(req, { action: "DELETE_ANNOUNCEMENT", targetType: "announcements", targetId: id });
        res.json({ message: "Annonce supprimée" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de supprimer l'annonce" });
    }
}

module.exports = { getAnnouncement, updateAnnouncement, deleteAnnouncement };
