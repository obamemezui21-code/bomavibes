const { findLocalEvidence } = require("./localEvidence");
const { checkWithIsGenAI, isGenAIEnabled } = require("./isgenai");

// A. Preuves de provenance — what the text itself shows of an AI tool:
// declarations, traces, an assistant's leftover words. Evidence, not an
// estimate: no score. The local search always runs; isGenAI runs too when
// the teacher asked for it, and if it is down, the local search stands alone.
//
// Indication:
//   élevée  — a declaration, or a trace only a tool leaves (direct evidence);
//   modérée — an assistant's words left in the text;
//   faible  — AI tools are only named (a homework about AI names them too);
//   aucune  — nothing found. Which never shows the text is the student's own.

const LEVELS = {
    elevee: "Indication élevée",
    moderee: "Indication modérée",
    faible: "Indication faible",
    aucune: "Aucune preuve trouvée",
};

/**
 * @param {{ text: string, external?: boolean }} input
 * @param {{ fetchImpl?: Function }} [deps]
 */
async function analyzeProvenance({ text, external = false }, { fetchImpl } = {}) {
    const local = findLocalEvidence(text);
    const isgenai = external ? await checkWithIsGenAI(text, { fetchImpl }) : { status: isGenAIEnabled() ? "not_requested" : "off" };

    const direct = local.findings.some((f) => f.kind === "declaration" || f.kind === "trace") || (isgenai.status === "ok" && isgenai.aiFound);
    const leftovers = local.findings.some((f) => f.kind === "leftover");
    const named = local.mentions.length > 0 || (isgenai.status === "ok" && isgenai.evidence.length > 0);
    const level = direct ? "elevee" : leftovers ? "moderee" : named ? "faible" : "aucune";

    const tools = [...new Set([...local.tools])];
    const limitations = [
        "Ces preuves ne se trouvent que si elles sont restées dans le texte : un texte recopié ou reformulé n’en garde aucune. L’absence de preuve ne montre pas que le devoir est entièrement personnel.",
        "Une déclaration d’utilisation d’une IA n’est pas une fraude en soi : elle peut répondre à une consigne autorisant l’IA pour la recherche, la correction ou la traduction.",
    ];
    if (local.mentions.length && !direct) limitations.push("Les outils d’IA sont seulement nommés : c’est normal dans un devoir qui parle d’intelligence artificielle.");
    if (isgenai.status === "ok" && isgenai.truncated) limitations.push(`isGenAI n’a reçu que les ${isgenai.sentChars.toLocaleString("fr-FR")} premiers caractères (sa limite) ; la recherche locale a lu tout le texte.`);
    if (isgenai.status === "unavailable") limitations.push(isgenai.reason);
    if (isgenai.status === "ok" && isgenai.partial) limitations.push("Une partie des vérifications d’isGenAI n’a pas pu se faire (réponse « analyse incomplète ») : son résultat est partiel.");
    if (isgenai.status === "ok") limitations.push("isGenAI reconnaît surtout les déclarations rédigées en anglais ; la recherche locale lit aussi le français.");

    const engines = [{ key: "local", name: "Recherche locale BomaVibes", status: "ok", note: "Le texte n’a pas quitté le serveur." }];
    if (isgenai.status === "ok") engines.push({ key: "isgenai", name: "isGenAI", status: "ok", note: "Envoyé en mode privé, sans reçu public." });
    else if (isgenai.status === "unavailable") engines.push({ key: "isgenai", name: "isGenAI", status: "unavailable", note: isgenai.reason });
    else if (isgenai.status === "off") engines.push({ key: "isgenai", name: "isGenAI", status: "off", note: "Désactivé sur ce serveur." });
    else engines.push({ key: "isgenai", name: "isGenAI", status: "not_requested", note: "Non demandé pour cette analyse : le texte n’a pas été envoyé." });

    return {
        status: "ok",
        level,
        label: LEVELS[level],
        tools,
        findings: local.findings,
        mentions: local.mentions,
        isgenai: isgenai.status === "ok" ? { label: isgenai.label, summary: isgenai.summary, confidence: isgenai.confidence, headline: isgenai.headline, partial: isgenai.partial, aiFound: isgenai.aiFound, evidence: isgenai.evidence, disclosures: isgenai.disclosures, caveats: isgenai.caveats, truncated: isgenai.truncated } : null,
        engines,
        checkedAt: new Date().toISOString(),
        limitations,
    };
}

module.exports = { analyzeProvenance };
