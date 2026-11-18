// isGenAI (https://isgenai.com/api): reads the evidence a text carries —
// declarations of AI use, names of AI tools — not its style. No key, no
// account. Sent as private, without a public receipt.
//
// The homework text leaves BomaVibes here: only when the teacher ticked it
// for this analysis, and only when EDU_CHECK_ISGENAI is not "off". isGenAI
// says it may pass text to a configured provider (DeepSeek) for an estimate.

const ENDPOINT = "https://isgenai.com/v1/check";
// isGenAI's limit: 16,000 UTF-16 code units of text.
const MAX_CHARS = 16000;
const TIMEOUT_MS = 15000;

const enabled = () => (process.env.EDU_CHECK_ISGENAI || "on").trim().toLowerCase() !== "off";

const STRENGTH = { strong: "forte", moderate: "moyenne", weak: "faible", informational: "information" };
const VERDICT = {
    "AI involvement verified": "Utilisation d’une IA établie par une preuve",
    "Camera origin verified": "Origine vérifiée",
    "Origin unresolved": "Aucune preuve d’origine",
};

const str = (v, n = 400) => (typeof v === "string" ? v.slice(0, n) : "");

const HEADLINE = {
    "AI DETECTED": "IA détectée",
    "AI EDIT DETECTED": "Retouche par IA détectée",
    "LIKELY AI": "IA probable (estimation)",
    "NO AI SIGNAL DETECTED": "Aucun signal d’IA",
    "SIGNALS CONFLICT": "Signaux contradictoires",
    "SCAN FAILED": "Analyse incomplète",
};

// isGenAI answers in English: its usual sentences, in French. Anything else
// is shown as it came, marked as isGenAI's own words.
const PHRASES = [
    [/^A disclosure or label was found, but no trusted origin evidence has resolved this case\.?$/i, () => "Une déclaration ou une mention a été trouvée, sans preuve d’origine certifiée."],
    [/^No reliable origin evidence survived in this copy\.?$/i, () => "Aucune preuve d’origine fiable dans ce texte."],
    [/^AI-related wording was found in this copy\.?$/i, () => "Une formulation liée à l’usage d’une IA a été trouvée."],
    [/^This text mentions an AI tool: (.+?)\.?$/i, (m) => `Le texte nomme un outil d’IA : ${m[1]}.`],
    [/^Declarations are useful evidence, but they are not the same as a trusted provider signal or signed origin credential\.?$/i, () => "Une déclaration est une preuve utile, mais pas un signal certifié par le fournisseur de l’IA."],
    [/^No evidence does not mean human-made\..*$/i, () => "L’absence de preuve ne signifie pas que le texte a été écrit sans IA."],
];
function fr(v, n = 400) {
    const s = str(v, n).trim();
    for (const [re, to] of PHRASES) {
        const m = s.match(re);
        if (m) return to(m);
    }
    return s;
}

/**
 * @param {string} text
 * @param {{ fetchImpl?: Function }} [deps]
 * @returns {Promise<object>} { status: "ok"|"unavailable"|"off", … }
 */
async function checkWithIsGenAI(text, { fetchImpl = globalThis.fetch } = {}) {
    if (!enabled()) return { status: "off", reason: "Désactivé sur ce serveur (EDU_CHECK_ISGENAI=off)." };
    const body = String(text).trim();
    const sent = body.slice(0, MAX_CHARS);
    let res;
    try {
        res = await fetchImpl(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "EduCheck/1.0" },
            body: JSON.stringify({ text: sent, kind: "text", privacy: "private", public_receipt: false }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            redirect: "error",
        });
    } catch {
        return { status: "unavailable", reason: "isGenAI ne répond pas : seule la recherche locale a été faite." };
    }
    let data = null;
    try {
        data = await res.json();
    } catch {
        /* not JSON */
    }
    if (!res.ok || data?.schema !== "isgenai.check.v1") {
        const busy = res.status === 429 || data?.error?.code === "busy";
        return { status: "unavailable", reason: busy ? "isGenAI est saturé pour le moment : seule la recherche locale a été faite." : "isGenAI n’a pas pu analyser ce texte : seule la recherche locale a été faite." };
    }
    // Only what isGenAI found, in its own words: positive evidence first.
    const evidence = (Array.isArray(data.evidence) ? data.evidence : [])
        .filter((e) => e && (e.outcome === "detected" || e.outcome === "match" || e.outcome === "manifest_present"))
        .slice(0, 10)
        .map((e) => ({
            kind: e.class === "explicit_disclosure" || e.class === "declarative_metadata" ? "declaration" : e.class === "probabilistic_detector" ? "estimate" : "trace",
            strength: STRENGTH[e.strength] || "information",
            direct: e.directness === "direct",
            summary: fr(e.summary),
            snippet: str(e.snippet, 300),
            mechanism: str(e.mechanism, 80),
        }));
    const disclosures = (Array.isArray(data.disclosures) ? data.disclosures : []).slice(0, 10).map((d) => ({ snippet: str(d.snippet, 300) }));
    const verdict = data.verdict || {};
    return {
        status: "ok",
        verdict: str(verdict.code, 40),
        label: VERDICT[verdict.label] || str(verdict.label, 80),
        summary: fr(verdict.summary),
        confidence: { high: "élevée", medium: "moyenne", low: "faible" }[verdict.confidence] || null,
        // Origin verified, or a declaration isGenAI itself reads as AI use.
        aiFound: verdict.code === "AI_INVOLVEMENT_VERIFIED" || data.public_result?.headline === "AI DETECTED" || data.public_result?.headline === "AI EDIT DETECTED",
        // Part of isGenAI's checks could not run.
        partial: data.public_result?.headline === "SCAN FAILED",
        // "Tool mention", "No direct signal"…: what the verdict rests on.
        basis: str(data.public_result?.basis, 40),
        headline: HEADLINE[data.public_result?.headline] || str(data.public_result?.headline, 40),
        evidence,
        disclosures,
        caveats: (verdict.caveats || []).slice(0, 4).map((c) => fr(c, 300)),
        truncated: sent.length < body.length,
        sentChars: sent.length,
    };
}

module.exports = { checkWithIsGenAI, isGenAIEnabled: enabled, ISGENAI_MAX_CHARS: MAX_CHARS };
