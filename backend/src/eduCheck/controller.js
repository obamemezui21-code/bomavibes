const { z } = require("zod");
const admin = require("../config/firebaseAdmin");
const { CONFIG, LEVELS, CHECKS, DISCLAIMER } = require("./config");
const { eduAccess, canRead, canDelete, ROLES } = require("./access");
const { parseDocument, ParseError } = require("./documentParser");
const { runAnalysis, plannedSteps, STEP_LABELS } = require("./engine");
const { compareTexts } = require("./analysis/styleComparison");
const { wordCount, normalizeText, detectLanguage } = require("./text");
const { providerStatus } = require("./ai/provider");

// /api/edu-check — EDU-CHECK, the homework-analysis assistant.
//
// Firestore (Admin SDK only — no client rule opens these):
//   eduCheckMembers/{uid}       role (teacher | lead), org — scripts/setEduRole.js
//   eduCheckAnalyses/{id}       one analysis: ownerUid, org, meta, checks,
//                               status, steps, text, result, expiresAt
//   eduCheckLogs/{id}           who did what, when (never any text)
//   eduCheckSourceCache/{hash}  external reference lookups, 30 days
//
// The homework text is data only: it is analysed by local code and never
// handed to anything as instructions. Analyses are deleted after
// CONFIG.retentionDays (purged as their owner's list is read), or on demand.

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;
const analyses = () => db.collection("eduCheckAnalyses");

const STATUS = { PENDING: "pending", RUNNING: "running", DONE: "done", INCONCLUSIVE: "inconclusive", FAILED: "failed" };

function log(uid, action, analysisId = null, extra = {}) {
    return db
        .collection("eduCheckLogs")
        .add({ uid, action, analysisId, ...extra, at: FieldValue.serverTimestamp() })
        .catch((err) => console.error("EDU-CHECK log:", err.message));
}

function fail(res, err, fallback) {
    if (err instanceof ParseError || err?.status === 400) return res.status(400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: fallback });
}

const short = (max) => z.string().trim().max(max).optional().default("");

const MetaSchema = z.object({
    establishment: short(120),
    student: short(120),
    className: short(80),
    subject: short(80),
    teacher: short(120),
    topic: short(2000),
    level: z.enum(Object.keys(LEVELS)).optional(),
    levelLabel: short(60),
    submittedAt: short(20),
});

const AnalysisSchema = z.object({
    text: z.string().min(1),
    meta: MetaSchema.default({}),
    checks: z.array(z.enum(CHECKS)).min(1),
    priorTexts: z.array(z.string()).max(CONFIG.maxPriorTexts).default([]),
});

const CompareSchema = z.object({
    texts: z.array(z.object({ label: z.string().trim().min(1).max(60), text: z.string().min(1) })).min(2).max(CONFIG.maxCompareTexts),
});

function checkLength(text, label = "Le texte") {
    const n = wordCount(text);
    if (n > CONFIG.maxWords) {
        const err = new Error(`${label} dépasse la limite de ${CONFIG.maxWords} mots (${n} mots).`);
        err.status = 400;
        throw err;
    }
    return n;
}

// GET /api/edu-check/me → may this account use EDU-CHECK, and the settings.
async function getMe(req, res) {
    try {
        const access = await eduAccess(req.firebaseUser.uid);
        res.json({
            allowed: access.allowed,
            role: access.role,
            org: access.org,
            limits: { maxFileMb: Math.round(CONFIG.maxFileBytes / 1024 / 1024), maxWords: CONFIG.maxWords, minWords: CONFIG.minWords, retentionDays: CONFIG.retentionDays, maxPriorTexts: CONFIG.maxPriorTexts, maxCompareTexts: CONFIG.maxCompareTexts },
            levels: LEVELS,
            checks: CHECKS,
            disclaimer: DISCLAIMER,
            sourceVerification: CONFIG.sourceVerification,
            ai: providerStatus(),
        });
    } catch (err) {
        fail(res, err, "Une erreur interne est survenue");
    }
}

// POST /api/edu-check/parse (multipart, field "file") → { text, words, kind, language }
// The file is read in memory and dropped: only its text comes back.
async function parseFile(req, res) {
    try {
        if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu." });
        const parsed = await parseDocument(req.file);
        checkLength(parsed.text, "Ce document");
        log(req.edu.uid, "parse", null, { kind: parsed.kind, words: parsed.words });
        res.json({ ...parsed, language: detectLanguage(parsed.text) });
    } catch (err) {
        fail(res, err, "Impossible de lire ce document.");
    }
}

// The analysis runs after the answer: its steps are written as they go,
// which is what the page shows (GET /analyses/:id).
async function execute(ref, input) {
    let lastWrite = 0;
    try {
        await ref.update({ status: STATUS.RUNNING, startedAt: FieldValue.serverTimestamp() });
        const { result, steps } = await runAnalysis(input, {
            db,
            onStep: async (steps) => {
                // Every change of step is written, at most every 300 ms.
                const now = Date.now();
                if (now - lastWrite < 300 && !steps.some((s) => s.status === "failed")) return;
                lastWrite = now;
                await ref.update({ steps }).catch(() => {});
            },
        });
        await ref.update({
            steps,
            result,
            status: result.conclusive ? STATUS.DONE : STATUS.INCONCLUSIVE,
            summary: summaryOf(result),
            finishedAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error("EDU-CHECK analysis failed:", err);
        await ref.update({ status: STATUS.FAILED, error: "L’analyse a échoué. Réessayez.", finishedAt: FieldValue.serverTimestamp() }).catch(() => {});
    }
}

// The figures the history and dashboard need, without reading every result.
function summaryOf(r) {
    return {
        words: r.words,
        language: r.language,
        aiScore: r.ai?.status === "ok" ? r.ai.score : null,
        aiBand: r.ai?.status === "ok" ? r.ai.band : r.ai ? "non_concluant" : null,
        quality: r.quality?.status === "ok" ? r.quality.score : null,
        coherence: r.coherence?.status === "ok" ? r.coherence.score : null,
        sourcesToVerify: r.sources?.status === "ok" ? r.sources.toVerify : 0,
        styleSimilarity: r.style?.status === "ok" ? r.style.similarity : null,
        attention: r.attention?.length > 0,
    };
}

// POST /api/edu-check/analyses { text, meta, checks, priorTexts } → 202 { id }
async function createAnalysis(req, res) {
    try {
        const parsed = AnalysisSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Données invalides : vérifiez le texte, le niveau et les analyses choisies." });
        const { meta, checks, priorTexts } = parsed.data;
        const text = normalizeText(parsed.data.text);
        const words = checkLength(text);
        if (!words) return res.status(400).json({ message: "Le texte est vide." });
        priorTexts.forEach((t, i) => checkLength(t, `Le travail antérieur n° ${i + 1}`));

        const ref = analyses().doc();
        const steps = plannedSteps(checks).map((key) => ({ key, label: STEP_LABELS[key], status: "pending" }));
        await ref.set({
            ownerUid: req.edu.uid,
            org: req.edu.org,
            meta,
            checks,
            priorCount: priorTexts.length,
            text,
            words,
            status: STATUS.PENDING,
            steps,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + CONFIG.retentionDays * 86400000),
        });
        log(req.edu.uid, "analyse", ref.id, { checks, words });
        res.status(202).json({ id: ref.id });
        // Prior works are used for this run only, never stored.
        execute(ref, { text, checks, meta, priorTexts });
    } catch (err) {
        fail(res, err, "Impossible de lancer l’analyse.");
    }
}

const millis = (t) => t?.toMillis?.() ?? null;

function listItem(id, d) {
    return {
        id,
        status: d.status,
        meta: d.meta || {},
        checks: d.checks || [],
        words: d.words,
        summary: d.summary || null,
        createdAt: millis(d.createdAt),
        mine: undefined,
    };
}

// Every analysis this account may see: theirs, and their institution's for a lead.
async function visibleAnalyses(access) {
    const queries = [analyses().where("ownerUid", "==", access.uid).limit(500).get()];
    if (access.role === ROLES.LEAD && access.org) queries.push(analyses().where("org", "==", access.org).limit(1000).get());
    const snaps = await Promise.all(queries);
    const byId = new Map();
    const now = Date.now();
    const expired = [];
    for (const snap of snaps) {
        for (const doc of snap.docs) {
            const d = doc.data();
            if (millis(d.expiresAt) && millis(d.expiresAt) < now) {
                expired.push(doc.ref);
                continue;
            }
            byId.set(doc.id, { ...listItem(doc.id, d), mine: d.ownerUid === access.uid });
        }
    }
    // Retention: past their date, analyses (and their text) are deleted.
    if (expired.length) Promise.all(expired.slice(0, 200).map((r) => r.delete())).catch(() => {});
    return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

const BANDS = ["faible", "limite", "modere", "eleve", "tres_eleve", "non_concluant"];

// GET /api/edu-check/analyses?student&className&subject&teacher&from&to&band
async function listAnalyses(req, res) {
    try {
        const q = req.query;
        const has = (value, wanted) => !wanted || String(value || "").toLowerCase().includes(String(wanted).toLowerCase());
        const from = q.from ? Date.parse(`${q.from}T00:00:00`) : null;
        const to = q.to ? Date.parse(`${q.to}T23:59:59`) : null;
        const band = BANDS.includes(q.band) ? q.band : null;
        const items = (await visibleAnalyses(req.edu)).filter(
            (a) =>
                has(a.meta.student, q.student) &&
                has(a.meta.className, q.className) &&
                has(a.meta.subject, q.subject) &&
                has(a.meta.teacher, q.teacher) &&
                (!from || (a.createdAt || 0) >= from) &&
                (!to || (a.createdAt || 0) <= to) &&
                (!band || a.summary?.aiBand === band),
        );
        res.json({ analyses: items.slice(0, 300), total: items.length });
    } catch (err) {
        fail(res, err, "Impossible de charger l’historique.");
    }
}

// GET /api/edu-check/analyses/:id → the full analysis, text included.
async function getAnalysis(req, res) {
    try {
        const snap = await analyses().doc(String(req.params.id)).get();
        const d = snap.data();
        if (!snap.exists || !canRead(req.edu, d) || (millis(d.expiresAt) && millis(d.expiresAt) < Date.now())) {
            return res.status(404).json({ message: "Analyse introuvable." });
        }
        res.json({
            id: snap.id,
            status: d.status,
            steps: d.steps || [],
            meta: d.meta || {},
            checks: d.checks || [],
            words: d.words,
            priorCount: d.priorCount || 0,
            text: d.text,
            result: d.result || null,
            error: d.error || null,
            createdAt: millis(d.createdAt),
            finishedAt: millis(d.finishedAt),
            expiresAt: millis(d.expiresAt),
            mine: d.ownerUid === req.edu.uid,
        });
    } catch (err) {
        fail(res, err, "Impossible de charger l’analyse.");
    }
}

// DELETE /api/edu-check/analyses/:id
async function deleteAnalysis(req, res) {
    try {
        const ref = analyses().doc(String(req.params.id));
        const snap = await ref.get();
        if (!snap.exists || !canDelete(req.edu, snap.data())) return res.status(404).json({ message: "Analyse introuvable." });
        await ref.delete();
        log(req.edu.uid, "suppression", ref.id);
        res.status(204).end();
    } catch (err) {
        fail(res, err, "Impossible de supprimer l’analyse.");
    }
}

// POST /api/edu-check/compare { texts: [{ label, text }] } → the comparison (not stored).
async function compare(req, res) {
    try {
        const parsed = CompareSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: `Donnez entre 2 et ${CONFIG.maxCompareTexts} textes, chacun avec un nom.` });
        const texts = parsed.data.texts.map((t) => ({ label: t.label, text: normalizeText(t.text) }));
        texts.forEach((t) => checkLength(t.text, `« ${t.label} »`));
        if (texts.some((t) => wordCount(t.text) < 30)) return res.status(400).json({ message: "Chaque texte doit faire au moins 30 mots." });
        log(req.edu.uid, "comparaison", null, { count: texts.length });
        res.json(compareTexts({ texts, lang: detectLanguage(texts.map((t) => t.text).join("\n")) || "fr" }));
    } catch (err) {
        fail(res, err, "Impossible de comparer ces textes.");
    }
}

// GET /api/edu-check/dashboard → figures over everything this account may see.
async function getDashboard(req, res) {
    try {
        const items = await visibleAnalyses(req.edu);
        const finished = items.filter((a) => a.status === STATUS.DONE || a.status === STATUS.INCONCLUSIVE);
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            months.push({ key, label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), count: 0 });
        }
        for (const a of items) {
            const d = new Date(a.createdAt || 0);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const m = months.find((x) => x.key === key);
            if (m) m.count++;
        }
        const bands = {};
        for (const a of finished) if (a.summary?.aiBand) bands[a.summary.aiBand] = (bands[a.summary.aiBand] || 0) + 1;
        res.json({
            analysed: finished.length,
            conclusive: finished.filter((a) => a.status === STATUS.DONE).length,
            sourcesToVerify: finished.reduce((s, a) => s + (a.summary?.sourcesToVerify || 0), 0),
            attention: finished.filter((a) => a.summary?.attention).length,
            failed: items.filter((a) => a.status === STATUS.FAILED).length,
            monthly: months,
            bands,
            scope: req.edu.role === ROLES.LEAD && req.edu.org ? "etablissement" : "personnel",
        });
    } catch (err) {
        fail(res, err, "Impossible de charger le tableau de bord.");
    }
}

module.exports = { getMe, parseFile, createAnalysis, listAnalyses, getAnalysis, deleteAnalysis, compare, getDashboard, summaryOf };
