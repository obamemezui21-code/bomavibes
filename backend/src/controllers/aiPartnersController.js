// Affiliate directory ("Studio IA") — BomaVibes never handles payment or AI
// generation itself, only the referral link and (for its own stats) a click
// record. Kept separate from contentService.js's generic CONTENT_TYPES
// system on purpose: that system bakes in a draft/published/archived
// `status` lifecycle unconditionally, which doesn't fit this collection's
// simple `actif` boolean, and `prixVerifieLe` needs bespoke
// set-only-when-price-changes behavior no generic field type has.
const admin = require("../config/firebaseAdmin");
const { logAdminAction } = require("../services/adminLogService");

const db = admin.firestore();
const COLLECTION = "aiPartners";

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function handleError(res, err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
}

// `partial`: only validates/returns fields actually present in body (PATCH).
// On full create, required fields must be present.
function readFields(body, { partial = false } = {}) {
    const data = {};

    if (!partial || "nom" in body) {
        const nom = typeof body.nom === "string" ? body.nom.trim() : "";
        if (!nom) throw badRequest("Nom requis");
        if (nom.length > 150) throw badRequest("Nom trop long");
        data.nom = nom;
    }
    if (!partial || "description" in body) {
        const description = typeof body.description === "string" ? body.description.trim() : "";
        if (description.length > 500) throw badRequest("Description trop longue");
        data.description = description || null;
    }
    if (!partial || "idealPour" in body) {
        const idealPour = typeof body.idealPour === "string" ? body.idealPour.trim() : "";
        if (idealPour.length > 200) throw badRequest("Champ « idéal pour » trop long");
        data.idealPour = idealPour || null;
    }
    if (!partial || "logoUrl" in body) {
        const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
        if (logoUrl.length > 2000) throw badRequest("URL du logo trop longue");
        data.logoUrl = logoUrl || null;
    }
    if (!partial || "lienAffilie" in body) {
        const lienAffilie = typeof body.lienAffilie === "string" ? body.lienAffilie.trim() : "";
        if (!lienAffilie) throw badRequest("Lien affilié requis");
        if (lienAffilie.length > 2000) throw badRequest("Lien affilié trop long");
        data.lienAffilie = lienAffilie;
    }
    if (!partial || "prixAPartirDe" in body) {
        const prixAPartirDe = Number(body.prixAPartirDe);
        data.prixAPartirDe = Number.isFinite(prixAPartirDe) && prixAPartirDe > 0 ? prixAPartirDe : 0;
    }
    if (!partial || "devise" in body) {
        const devise = typeof body.devise === "string" ? body.devise.trim().toUpperCase() : "";
        data.devise = devise.slice(0, 10) || "USD";
    }
    if (!partial || "planGratuit" in body) {
        data.planGratuit = !!body.planGratuit;
    }
    if (!partial || "ordre" in body) {
        const ordre = Number(body.ordre);
        data.ordre = Number.isFinite(ordre) ? ordre : 0;
    }
    if (!partial || "actif" in body) {
        data.actif = body.actif === undefined ? true : !!body.actif;
    }

    return data;
}

function serialize(docSnap) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        prixVerifieLe: data.prixVerifieLe?.toDate?.().toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    };
}

async function listPartners(req, res) {
    try {
        const snap = await db.collection(COLLECTION).orderBy("ordre", "asc").get();
        res.json({ items: snap.docs.map(serialize) });
    } catch (err) {
        handleError(res, err);
    }
}

async function createPartner(req, res) {
    try {
        const data = readFields(req.body || {});
        const now = admin.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection(COLLECTION).add({
            ...data,
            // Only stamped when a real price is set — an empty/0 price has
            // never been "verified", so there's nothing to date.
            prixVerifieLe: data.prixAPartirDe > 0 ? now : null,
            createdAt: now,
            updatedAt: now,
        });
        await logAdminAction(req, { action: "CREATE_AI_PARTNER", targetType: "aiPartners", targetId: ref.id, metadata: { nom: data.nom } });
        const snap = await ref.get();
        res.status(201).json({ item: serialize(snap) });
    } catch (err) {
        handleError(res, err);
    }
}

async function updatePartner(req, res) {
    const { id } = req.params;
    const ref = db.collection(COLLECTION).doc(id);
    try {
        const existing = await ref.get();
        if (!existing.exists) return res.status(404).json({ message: "Partenaire introuvable" });

        const data = readFields(req.body || {}, { partial: true });
        const payload = { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        // Re-stamp prixVerifieLe only when the price actually changes — not
        // on every unrelated edit (e.g. toggling actif shouldn't touch it).
        if ("prixAPartirDe" in data && data.prixAPartirDe !== (existing.data().prixAPartirDe || 0)) {
            payload.prixVerifieLe = data.prixAPartirDe > 0 ? admin.firestore.FieldValue.serverTimestamp() : null;
        }

        await ref.update(payload);
        await logAdminAction(req, { action: "UPDATE_AI_PARTNER", targetType: "aiPartners", targetId: id });
        const snap = await ref.get();
        res.json({ item: serialize(snap) });
    } catch (err) {
        handleError(res, err);
    }
}

async function deletePartner(req, res) {
    const { id } = req.params;
    try {
        const ref = db.collection(COLLECTION).doc(id);
        const existing = await ref.get();
        if (!existing.exists) return res.status(404).json({ message: "Partenaire introuvable" });
        await ref.delete();
        await logAdminAction(req, { action: "DELETE_AI_PARTNER", targetType: "aiPartners", targetId: id });
        res.json({ message: "Partenaire supprimé" });
    } catch (err) {
        handleError(res, err);
    }
}

async function getStats(req, res) {
    try {
        const partnersSnap = await db.collection(COLLECTION).get();
        const now = Date.now();
        const cutoff7Ms = now - 7 * 24 * 60 * 60 * 1000;
        const cutoff30 = admin.firestore.Timestamp.fromMillis(now - 30 * 24 * 60 * 60 * 1000);

        const stats = {};
        partnersSnap.docs.forEach((p) => {
            stats[p.id] = { last7Days: 0, last30Days: 0, total: 0 };
        });

        // Single-field range filter only (`date >= cutoff30`) — deliberately
        // NOT combined with a `where("partnerId", ...)` equality filter,
        // which would need a composite index this repo has no pipeline to
        // deploy (same Firestore limitation noted in contentService.js).
        // Grouped by partner in memory instead.
        const recentSnap = await db.collection("aiClicks").where("date", ">=", cutoff30).get();
        recentSnap.docs.forEach((docSnap) => {
            const { partnerId, date } = docSnap.data();
            if (!partnerId || !stats[partnerId]) return;
            stats[partnerId].last30Days += 1;
            if ((date?.toMillis?.() ?? 0) >= cutoff7Ms) stats[partnerId].last7Days += 1;
        });

        // All-time total: a separate equality-only count() aggregation per
        // partner — no composite index needed, and no document bodies
        // transferred.
        await Promise.all(
            partnersSnap.docs.map(async (p) => {
                const countSnap = await db.collection("aiClicks").where("partnerId", "==", p.id).count().get();
                stats[p.id].total = countSnap.data().count;
            }),
        );

        res.json({ stats });
    } catch (err) {
        handleError(res, err);
    }
}

module.exports = { listPartners, createPartner, updatePartner, deletePartner, getStats };
