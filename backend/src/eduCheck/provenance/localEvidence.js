const { excerpt } = require("../text");

// Evidence an AI tool was used, read in the text itself — not its style.
//   - declaration: the student says so ("rédigé avec l'aide de ChatGPT");
//   - trace: something only a tool leaves behind when its answer is pasted
//     (ChatGPT's "utm_source=chatgpt.com" links, its "【4†source】" or
//     "contentReference[oaicite:0]" citation marks, a conversation's share
//     link);
//   - leftover: the assistant's own words, pasted with the homework ("En tant
//     qu'IA…", "Bien sûr ! Voici une dissertation…", "[Votre nom]");
//   - mention: an AI tool is named, nothing more — a homework about AI names
//     them too. Context, never evidence.
// A tool is named only when the evidence itself names it.

const TOOLS = [
    ["ChatGPT", /\b(?:chat\s?-?gpt|gpt-?[345](?:\.\d)?o?|openai)\b/i],
    ["Claude", /\bclaude(?:\.ai)?\b(?!\s+(?:bernard|monet|lévi|debussy|françois|nougaro))/i],
    ["Gemini", /\b(?:gemini|google\s+bard|bard)\b/i],
    ["Copilot", /\b(?:copilot|bing\s+chat)\b/i],
    ["DeepSeek", /\bdeep\s?seek\b/i],
    ["Mistral", /\b(?:mistral\s?(?:ai)?|le\s+chat\s+(?:de\s+)?mistral)\b/i],
    ["Llama", /\b(?:llama|meta\s+ai)\b/i],
    ["Qwen", /\bqwen\b/i],
    ["Perplexity", /\bperplexity\b/i],
    ["Grok", /\bgrok\b/i],
];
const ANY_TOOL = new RegExp(TOOLS.map(([, re]) => re.source).join("|"), "gi");
const AI = String.raw`(?:l['’]\s?)?(?:intelligence\s+artificielle|ia\s+générative|ia\b|${ANY_TOOL.source})`;

const toolsIn = (s) => TOOLS.filter(([, re]) => re.test(s)).map(([name]) => name);

const RULES = [
    // The student declares it.
    {
        kind: "declaration",
        label: "Déclaration d’utilisation d’une IA",
        re: new RegExp(
            String.raw`\b(?:(?:rédigé|écrit|généré|produit|réalisé|traduit|corrigé|reformulé|résumé|fait|aidé)e?s?\s+(?:avec|par|grâce\s+à|à\s+l['’]aide\s+d['’e]|en\s+utilisant)\s+(?:l['’]aide\s+d['’e]\s+)?${AI}|(?:avec|grâce\s+à)\s+l['’]aide\s+d['’e]\s+${AI}|j['’]ai\s+(?:utilisé|employé|demandé\s+à|eu\s+recours\s+à)\s+${AI}|(?:written|generated|drafted|produced)\s+(?:with|by|using)\s+(?:the\s+help\s+of\s+)?${AI})`,
            "giu",
        ),
    },
    // Things a tool leaves in pasted text.
    { kind: "trace", label: "Lien copié depuis ChatGPT (utm_source=chatgpt.com)", re: /utm_source=chatgpt\.com/gi, tool: "ChatGPT" },
    { kind: "trace", label: "Marque de citation de ChatGPT", re: /(?:contentReference\s*\[\s*oaicite|:contentReference|【\d+[:†][^】]{0,40}】|\bciteturn\d|\bturn\d+(?:search|news|view)\d+)/gi, tool: "ChatGPT" },
    { kind: "trace", label: "Lien de partage d’une conversation avec une IA", re: /\b(?:chatgpt\.com\/share|chat\.openai\.com\/share|claude\.ai\/(?:share|chat)|g\.co\/gemini\/share|gemini\.google\.com\/(?:share|app)|chat\.deepseek\.com|chat\.mistral\.ai|copilot\.microsoft\.com|perplexity\.ai\/search)\/?\S*/gi },
    // The assistant's own words.
    {
        kind: "leftover",
        label: "Phrase d’assistant IA restée dans le texte",
        re: /\b(?:en tant qu['’](?:intelligence artificielle|ia|assistant(?: virtuel)?|modèle de langage)|je suis (?:une intelligence artificielle|une ia|un modèle de langage|un assistant (?:virtuel|ia))|as an ai(?: language model)?|i(?:'|’)m an ai\b|je n['’]ai pas (?:accès à internet|d['’]opinions? personnelles?)|ma date de (?:coupure|limite) de connaissances|knowledge cutoff)/gi,
    },
    {
        kind: "leftover",
        label: "Réponse d’assistant IA copiée avec le devoir",
        re: /(?:^|\n)\s*(?:bien sûr|certainement|absolument|avec plaisir|d['’]accord|parfait|excellente question|sure|certainly|of course)\s*[!,.:]\s*(?:voici|je vous propose|here(?:'|’)s|here is)\b[^\n]{0,120}|\bvoici (?:une|un|la|le|ma|mon) (?:proposition de |version (?:révisée |améliorée )?(?:de |d['’])?)?(?:dissertation|rédaction|introduction|conclusion|plan|résumé|commentaire|texte|exposé|devoir|réponse)\b[^\n.]{0,60}\s*:|\b(?:n['’]hésitez pas à me (?:demander|dire|solliciter)|souhaitez-vous que je|voulez-vous que je|si vous (?:le )?souhaitez, je peux|je peux (?:aussi|également) vous (?:proposer|aider)|j['’]espère que cela (?:vous )?(?:aide|aidera|répond)|let me know if you)\b[^\n]{0,80}/gi,
    },
    { kind: "leftover", label: "Champ à remplir laissé par un modèle", re: /\[(?:votre|ton|insérer|insérez|nom de l['’]|prénom|your|insert)[^\]\n]{0,40}\]/gi },
];

const MAX_PER_RULE = 5;

/**
 * @param {string} text
 * @returns {{ findings: object[], tools: string[], mentions: { tool: string, count: number }[] }}
 */
function findLocalEvidence(text) {
    const t = String(text || "");
    const findings = [];
    for (const rule of RULES) {
        let n = 0;
        for (const m of t.matchAll(rule.re)) {
            const at = m.index + (m[0].length - m[0].trimStart().length);
            const s = m[0].trim();
            const tools = rule.tool ? [rule.tool] : toolsIn(s);
            findings.push({ kind: rule.kind, label: rule.label, tools, passage: excerpt(t, at, at + s.length, 70) });
            if (++n >= MAX_PER_RULE) break;
        }
    }
    // A tool's name on its own: how often each is named.
    const mentions = TOOLS.map(([tool, re]) => ({ tool, count: (t.match(new RegExp(re.source, "gi")) || []).length })).filter((m) => m.count);
    const tools = [...new Set(findings.filter((f) => f.kind !== "mention").flatMap((f) => f.tools))];
    return { findings, tools, mentions };
}

module.exports = { findLocalEvidence, TOOLS };
