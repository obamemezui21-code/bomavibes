const { CONFIG, CHECKS, DISCLAIMER, LEVELS } = require("./config");
const { normalizeText, wordCount, detectLanguage, proseOf } = require("./text");

// Below this share of written sentences, the style indices are "non concluant".
const MIN_PROSE_SHARE = 0.5;
const { analyzeAiWriting } = require("./analysis/aiWriting");
const { analyzeWritingQuality } = require("./analysis/writingQuality");
const { analyzeRelevance } = require("./analysis/relevance");
const { analyzeLevel } = require("./analysis/academicLevel");
const { analyzeStyle, styleProfile } = require("./analysis/styleComparison");
const { analyzeSources, withoutBibliography } = require("./sources/sourceVerification");
const { providerStatus } = require("./ai/provider");
const { analyzeProvenance } = require("./provenance");
const { estimateWithModel } = require("./ml/detector");

// Runs the analyses a teacher picked, one step after the other. Each step is
// reported as it starts and ends (onStep): that is the progress the teacher
// sees, not an animation. A step that fails is marked so; the others go on.

const STEP_LABELS = {
    prepare: "Lecture du texte",
    provenance: "Preuves de provenance IA",
    ml: "Estimation par modèle de langage",
    ai: "Analyse stylistique",
    quality: "Qualité rédactionnelle",
    sources: "Vérification des sources",
    coherence: "Cohérence et respect du sujet",
    style: "Comparaison avec les travaux antérieurs",
    level: "Niveau académique",
};

function plannedSteps(checks) {
    const order = ["prepare", "provenance", "ml", "style", "ai", "quality", "sources", "coherence", "level"];
    // The AI check is three separate results: provenance (A), the model's
    // estimate (B) and the style indices (C).
    const withAi = new Set(["provenance", "ml", "style"]);
    return order.filter((k) => k === "prepare" || checks.includes(k) || (withAi.has(k) && checks.includes("ai")));
}

/**
 * @param {{ text: string, checks: string[], meta: object, priorTexts?: string[] }} input
 * @param {{ db?: object, fetchImpl?: Function, onStep?: (steps: object[]) => void }} deps
 */
async function runAnalysis({ text: rawText, checks: wanted, meta = {}, priorTexts = [], options = {} }, { db, fetchImpl, onStep, detector } = {}) {
    const checks = CHECKS.filter((c) => wanted.includes(c));
    const text = normalizeText(rawText);
    const steps = plannedSteps(checks).map((key) => ({ key, label: STEP_LABELS[key], status: "pending" }));
    const set = async (key, status, note) => {
        const step = steps.find((s) => s.key === key);
        if (!step) return;
        step.status = status;
        if (note) step.note = note;
        await onStep?.(steps.map((s) => ({ ...s })));
    };
    const run = async (key, fn) => {
        await set(key, "running");
        try {
            const out = await fn();
            await set(key, out?.status === "inconclusive" ? "inconclusive" : "done");
            return out;
        } catch (err) {
            console.error(`EDU-CHECK ${key}:`, err);
            await set(key, "failed", "Cette analyse a échoué ; les autres continuent.");
            return { status: "failed", reason: "Cette analyse a échoué." };
        }
    };

    await set("prepare", "running");
    const words = wordCount(text);
    // The prose: written sentences only — no bibliography, titles, code,
    // tables. Sources read the whole text.
    const doc = proseOf(withoutBibliography(text));
    const prose = doc.prose;
    const lang = detectLanguage(prose);
    await set("prepare", "done");
    const share = Math.round(doc.share * 100);
    const result = {
        words,
        language: lang,
        disclaimer: DISCLAIMER,
        engine: { local: true, ai: providerStatus() },
        level: meta.level ? { key: meta.level, label: meta.levelLabel || LEVELS[meta.level] } : null,
        document: {
            proseWords: doc.proseWords,
            proseShare: share,
            codeLines: doc.codeLines,
            tableLines: doc.tableLines,
            kind: doc.share >= 0.8 ? "redige" : doc.share >= MIN_PROSE_SHARE ? "mixte" : "technique",
        },
    };
    // Mostly code, tables, lists: style indices would measure the layout,
    // not the writing. Said so, instead of a meaningless score.
    const notProse =
        doc.share < MIN_PROSE_SHARE
            ? `Ce document est surtout composé de code, de tableaux, de listes ou de titres (${share} % seulement de texte rédigé, ${doc.codeLines} lignes de code). Ces indices ne s’appliquent qu’à un texte rédigé : dissertation, rapport, commentaire, exposé…`
            : null;
    const proseNote = !notProse && share < 80 ? `${100 - share} % du document n’est pas du texte rédigé (code, tableaux, listes, titres) : cette partie a été écartée des indices.` : null;
    const inconclusive = (reason) => ({ status: "inconclusive", reason, signals: [], limitations: [] });

    const priors = priorTexts.map(normalizeText).filter(Boolean).slice(0, CONFIG.maxPriorTexts);
    if (checks.includes("ai")) {
        // A. Evidence in the whole text (a pasted link, a declaration in a
        // footnote count too), sent to isGenAI only if the teacher asked.
        result.provenance = await run("provenance", () => analyzeProvenance({ text, external: !!options.isgenai }, { fetchImpl }));
        // B. A language model's estimate, on the written prose only.
        result.ml = await run("ml", () => (notProse ? inconclusive(notProse) : estimateWithModel({ text: prose, lang }, { detector })));
    }
    if (steps.some((s) => s.key === "style")) {
        result.style = await run("style", () =>
            notProse ? (priors.length ? inconclusive(notProse) : analyzeStyle({ text: prose, lang, priorTexts: [] })) : analyzeStyle({ text: prose, lang, priorTexts: priors.map((p) => proseOf(withoutBibliography(p)).prose) }),
        );
    }
    if (checks.includes("ai")) {
        result.ai = await run("ai", () => {
            if (notProse) return inconclusive(notProse);
            const ai = analyzeAiWriting({ text: prose, lang, level: meta.level, style: result.style });
            if (proseNote && ai.status === "ok") ai.limitations.unshift(proseNote);
            return ai;
        });
    }
    if (checks.includes("quality")) result.quality = await run("quality", () => analyzeWritingQuality({ text: prose, lang }));
    if (checks.includes("sources")) result.sources = await run("sources", () => analyzeSources({ text, db, fetchImpl }));
    if (checks.includes("coherence")) result.coherence = await run("coherence", () => analyzeRelevance({ text: prose, lang, topic: meta.topic }));
    if (checks.includes("level")) {
        result.academicLevel = await run("level", () =>
            analyzeLevel({ level: meta.level, levelLabel: meta.levelLabel, style: wordCount(prose) >= 80 ? styleProfile(prose, lang || "fr") : null, quality: result.quality || analyzeWritingQuality({ text: prose, lang }), sources: result.sources }),
        );
    }

    result.conclusive = !!(result.ai?.status === "ok" || result.ml?.status === "ok" || result.provenance?.level === "elevee" || result.quality?.status === "ok" || result.coherence?.status === "ok");
    result.attention = needsAttention(result);
    result.recommendations = recommendations(result);
    return { result, steps, text };
}

// Worth a closer pedagogical look (never a sanction): high AI index, weak
// writing, sources to check.
function needsAttention(r) {
    const reasons = [];
    if (r.provenance?.level === "elevee") reasons.push("preuve d’utilisation d’une IA dans le texte");
    else if (r.provenance?.level === "moderee") reasons.push("phrase d’assistant IA restée dans le texte");
    if (r.ml?.status === "ok" && r.ml.band === "elevee") reasons.push("estimation élevée du modèle de langage");
    if (r.ai?.status === "ok" && r.ai.score > 60) reasons.push("indice stylistique IA élevé");
    if (r.quality?.status === "ok" && r.quality.score < 50) reasons.push("qualité rédactionnelle faible");
    if (r.sources?.status === "ok" && r.sources.toVerify > 0) reasons.push("sources à vérifier");
    if (r.coherence?.status === "ok" && r.coherence.score < 60) reasons.push("cohérence à revoir");
    if (r.style?.status === "ok" && r.style.similarity < 55) reasons.push("style éloigné des travaux antérieurs");
    return reasons;
}

function recommendations(r) {
    const out = [];
    if (r.provenance?.level === "elevee" || r.provenance?.level === "moderee") {
        out.push("Relire avec l’étudiant les passages signalés dans « Preuves de provenance » : vérifier si l’usage d’une IA était autorisé par la consigne, et pour quelle partie du travail.");
    }
    if ((r.ai?.status === "ok" && r.ai.score > 40) || (r.ml?.status === "ok" && r.ml.band !== "faible")) {
        out.push("Échanger avec l’étudiant sur sa démarche : lui demander d’expliquer oralement un passage, ses sources et ses brouillons.");
    }
    if (r.style?.status === "ok" && r.style.similarity < 55) out.push("Comparer avec un exercice rédigé en classe pour situer son style habituel.");
    if (r.quality?.status === "ok" && r.quality.score < 60) out.push("Proposer une relecture ciblée : ponctuation, phrases longues, fautes fréquentes relevées.");
    if (r.sources?.status === "ok" && r.sources.toVerify > 0) out.push("Vérifier les sources signalées et rappeler les règles de citation (auteur, année, page).");
    if (r.coherence?.status === "ok" && r.coherence.findings.some((f) => f.key === "examples" && f.level === "attention")) out.push("Encourager l’usage d’exemples précis pour appuyer les arguments.");
    if (r.coherence?.status === "ok" && r.coherence.findings.some((f) => f.key === "thin_arguments")) out.push("Inviter l’étudiant à développer chaque argument (idée, explication, exemple).");
    if (!out.length) out.push("Aucun point d’attention particulier : évaluation habituelle du contenu.");
    out.push("Aucune sanction ne doit être prise sur la seule base de ces indicateurs.");
    return out;
}

module.exports = { runAnalysis, plannedSteps, STEP_LABELS };
