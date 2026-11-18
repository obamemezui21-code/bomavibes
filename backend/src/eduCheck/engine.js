const { CONFIG, CHECKS, DISCLAIMER, LEVELS } = require("./config");
const { normalizeText, wordCount, detectLanguage, withoutHeadings } = require("./text");
const { analyzeAiWriting } = require("./analysis/aiWriting");
const { analyzeWritingQuality } = require("./analysis/writingQuality");
const { analyzeRelevance } = require("./analysis/relevance");
const { analyzeLevel } = require("./analysis/academicLevel");
const { analyzeStyle, styleProfile } = require("./analysis/styleComparison");
const { analyzeSources, withoutBibliography } = require("./sources/sourceVerification");
const { providerStatus } = require("./ai/provider");

// Runs the analyses a teacher picked, one step after the other. Each step is
// reported as it starts and ends (onStep): that is the progress the teacher
// sees, not an animation. A step that fails is marked so; the others go on.

const STEP_LABELS = {
    prepare: "Lecture du texte",
    ai: "Indices de rédaction assistée",
    quality: "Qualité rédactionnelle",
    sources: "Vérification des sources",
    coherence: "Cohérence et respect du sujet",
    style: "Comparaison avec les travaux antérieurs",
    level: "Niveau académique",
};

function plannedSteps(checks) {
    const order = ["prepare", "style", "ai", "quality", "sources", "coherence", "level"];
    return order.filter((k) => k === "prepare" || checks.includes(k) || (k === "style" && checks.includes("ai")));
}

/**
 * @param {{ text: string, checks: string[], meta: object, priorTexts?: string[] }} input
 * @param {{ db?: object, fetchImpl?: Function, onStep?: (steps: object[]) => void }} deps
 */
async function runAnalysis({ text: rawText, checks: wanted, meta = {}, priorTexts = [] }, { db, fetchImpl, onStep } = {}) {
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
    // The prose: no bibliography, no section titles. Sources read it all.
    const prose = withoutHeadings(withoutBibliography(text));
    const lang = detectLanguage(prose);
    await set("prepare", "done");
    const result = {
        words,
        language: lang,
        disclaimer: DISCLAIMER,
        engine: { local: true, ai: providerStatus() },
        level: meta.level ? { key: meta.level, label: meta.levelLabel || LEVELS[meta.level] } : null,
    };

    const priors = priorTexts.map(normalizeText).filter(Boolean).slice(0, CONFIG.maxPriorTexts);
    if (steps.some((s) => s.key === "style")) result.style = await run("style", () => analyzeStyle({ text: prose, lang, priorTexts: priors.map((p) => withoutHeadings(withoutBibliography(p))) }));
    if (checks.includes("ai")) result.ai = await run("ai", () => analyzeAiWriting({ text: prose, lang, level: meta.level, style: result.style }));
    if (checks.includes("quality")) result.quality = await run("quality", () => analyzeWritingQuality({ text: prose, lang }));
    if (checks.includes("sources")) result.sources = await run("sources", () => analyzeSources({ text, db, fetchImpl }));
    if (checks.includes("coherence")) result.coherence = await run("coherence", () => analyzeRelevance({ text: prose, lang, topic: meta.topic }));
    if (checks.includes("level")) {
        result.academicLevel = await run("level", () =>
            analyzeLevel({ level: meta.level, levelLabel: meta.levelLabel, style: wordCount(prose) >= 80 ? styleProfile(prose, lang || "fr") : null, quality: result.quality || analyzeWritingQuality({ text: prose, lang }), sources: result.sources }),
        );
    }

    result.conclusive = !!(result.ai?.status === "ok" || result.quality?.status === "ok" || result.coherence?.status === "ok");
    result.attention = needsAttention(result);
    result.recommendations = recommendations(result);
    return { result, steps, text };
}

// Worth a closer pedagogical look (never a sanction): high AI index, weak
// writing, sources to check.
function needsAttention(r) {
    const reasons = [];
    if (r.ai?.status === "ok" && r.ai.score > 60) reasons.push("indice de caractéristiques IA élevé");
    if (r.quality?.status === "ok" && r.quality.score < 50) reasons.push("qualité rédactionnelle faible");
    if (r.sources?.status === "ok" && r.sources.toVerify > 0) reasons.push("sources à vérifier");
    if (r.coherence?.status === "ok" && r.coherence.score < 60) reasons.push("cohérence à revoir");
    if (r.style?.status === "ok" && r.style.similarity < 55) reasons.push("style éloigné des travaux antérieurs");
    return reasons;
}

function recommendations(r) {
    const out = [];
    if (r.ai?.status === "ok" && r.ai.score > 40) {
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
