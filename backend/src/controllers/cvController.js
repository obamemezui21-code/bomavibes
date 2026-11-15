const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { writeCv, isConfigured, CvWriterError } = require("../services/cvWriter");
const { cleanForm, cleanCv, hasContent, view, PER_MEMBER_PER_DAY, ALL_MEMBERS_PER_DAY } = require("../services/cvForm");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// CV PNPE — members write their CV with the help of Claude (see
// services/cvWriter.js), then download it as a PDF (made on their phone).
//
// Firestore (Admin SDK only — no client rule opens these):
//   cvs/{uid}        form (what the member typed, identity included), cv (the
//                    written CV, as edited since), status, error, day/count
//   cvDaily/{day}    count: CVs written that day by everyone (budget cap)
//
// Writing takes 20–60 s: POST /generate answers at once and the page polls
// GET /, so neither nginx's timeout nor a phone switching apps loses the CV.

class CvError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendError(res, err, fallback) {
    if (err instanceof CvError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

// GET /api/cv
async function getCv(req, res) {
    try {
        const snap = await db.collection("cvs").doc(req.firebaseUser.uid).get();
        res.json(view(snap.data()));
    } catch (err) {
        sendError(res, err, "Impossible de charger votre CV");
    }
}

// PUT /api/cv { form?, cv? } — saves without writing anything with the AI.
async function saveCv(req, res) {
    try {
        const patch = { updatedAt: FieldValue.serverTimestamp() };
        if ("form" in req.body) patch.form = cleanForm(req.body.form);
        if ("cv" in req.body) patch.cv = cleanCv(req.body.cv);
        const ref = db.collection("cvs").doc(req.firebaseUser.uid);
        await ref.set(patch, { merge: true });
        res.json(view((await ref.get()).data()));
    } catch (err) {
        sendError(res, err, "Impossible d'enregistrer votre CV");
    }
}

// ---- Writing with the AI ----------------------------------------------------

async function runWrite(ref, form, uid) {
    try {
        const cv = await writeCv(form);
        await ref.set({ cv, status: "ready", error: null, generatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
        const message = err instanceof CvWriterError ? err.message : "La rédaction n'a pas abouti. Réessayez.";
        if (!(err instanceof CvWriterError)) console.error("[cv]", uid, err);
        // Not counted against the member: nothing was delivered.
        await ref
            .set({ status: "error", error: message, count: FieldValue.increment(-1) }, { merge: true })
            .catch((e) => console.error("[cv] status", uid, e));
    }
}

// POST /api/cv/generate { form }
async function generateCv(req, res) {
    const uid = req.firebaseUser.uid;
    try {
        if (!isConfigured()) throw new CvError(503, "Le générateur de CV n'est pas encore activé. Revenez bientôt !");

        const form = cleanForm(req.body?.form);
        if (!form.posteRecherche) throw new CvError(400, "Indiquez le poste que vous recherchez.");
        if (!hasContent(form)) throw new CvError(400, "Ajoutez au moins une expérience, une formation ou vos compétences.");

        const now = Date.now();
        const today = periodKey("day", now);
        const ref = db.collection("cvs").doc(uid);
        const dailyRef = db.collection("cvDaily").doc(today);

        await db.runTransaction(async (tx) => {
            const [snap, dailySnap] = await Promise.all([tx.get(ref), tx.get(dailyRef)]);
            const current = view(snap.data(), now);
            if (current.status === "pending") throw new CvError(409, "Votre CV est déjà en cours de rédaction.");
            if (current.remainingToday <= 0) {
                throw new CvError(429, `Vous avez créé ${PER_MEMBER_PER_DAY} CV aujourd'hui. Revenez demain, ou modifiez celui-ci à la main.`);
            }
            if ((dailySnap.data()?.count || 0) >= ALL_MEMBERS_PER_DAY) {
                throw new CvError(429, "Le générateur de CV est très demandé aujourd'hui. Réessayez demain.");
            }
            const used = snap.data()?.day === today ? snap.data().count || 0 : 0;
            tx.set(
                ref,
                {
                    form,
                    status: "pending",
                    error: null,
                    startedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    day: today,
                    count: used + 1,
                },
                { merge: true },
            );
            tx.set(dailyRef, { count: FieldValue.increment(1) }, { merge: true });
        });

        // Answered now; the page asks GET /api/cv until it's written.
        runWrite(ref, form, uid);
        res.status(202).json(view((await ref.get()).data()));
    } catch (err) {
        sendError(res, err, "Impossible de lancer la rédaction de votre CV");
    }
}

module.exports = { getCv, saveCv, generateCv };
