const { sentences, paragraphs, wordCount, excerpt, clamp } = require("../text");

// WritingQualityService — formal quality of the writing, checked locally.
//
// What is checked for real: typography and punctuation, repeated words,
// sentence starts, very long sentences, paragraph construction, frequent
// misspellings and errors from a list, use of argument connectors.
// What is NOT: a full spell / grammar check needs a dictionary or an external
// service (LanguageTool…); the result says so instead of pretending.

// Frequent French mistakes: [wrong form, correction, explanation].
const FR_ERRORS = [
    [/\bmalgrés?\b/gi, "malgré", "« malgré » ne prend jamais de s."],
    [/\bquelque soi(?:t|ent)\b/gi, "quel que soit", "« quel que soit » s’écrit en deux mots devant un nom ou un pronom."],
    [/\bparmis\b/gi, "parmi", "« parmi » ne prend pas de s."],
    [/\bau jour d'aujourd'hui\b/gi, "aujourd’hui", "Pléonasme : « aujourd’hui » suffit."],
    // "dévell…" (two l): always wrong; "dévelop…" with one p: the rule below.
    [/\bdévell\p{L}*/giu, "développer", "« développer » : un l, deux p."],
    [/\bdévelop(?:er|ement|é|ée|és|ées)\b/gi, "développer", "« développer » : un l, deux p."],
    [/\bapparament\b/gi, "apparemment", "« apparemment » s’écrit avec -emment."],
    [/\bdilemne\b/gi, "dilemme", "« dilemme » s’écrit avec deux m."],
    [/\brésonnement\b/gi, "raisonnement", "Le raisonnement (raisonner) n’est pas la résonance."],
    [/\bconnection\b/gi, "connexion", "En français : « connexion »."],
    [/\badresse(?:r)?\b(?= (?:un|le|ce) problème)/gi, "traiter / aborder", "Anglicisme : on « traite » ou on « aborde » un problème."],
    [/\blanguage\b/gi, "langage", "En français : « langage » (sans u)."],
    [/\bsensé(?:e|es|s)? (?=\p{L}+er\b)/giu, "censé", "Devant un infinitif, c’est « censé » (supposé)."],
    [/\bpallier à\b/gi, "pallier", "« pallier » se construit sans « à » : pallier un manque."],
    [/\bse rappeler de\b/gi, "se rappeler", "On se rappelle quelque chose (sans « de »)."],
    [/\bmalgré que\b/gi, "bien que", "« malgré que » est à éviter : « bien que »."],
    [/\bcomme même\b/gi, "quand même", "« quand même »."],
    [/\bil (?:faut|faudrait) que (?:on|nous) (?:peut|peux)\b/gi, "puisse", "Après « il faut que », le subjonctif : « puisse »."],
    [/\bsi j'aurais\b/gi, "si j’avais", "Après « si » de condition, pas de conditionnel : « si j’avais »."],
    [/\bils (?:croivent|voyent|croyent)\b/gi, "croient / voient", "Conjugaison : ils croient, ils voient."],
    [/\ba (?:cause|travers|partir|propos|côté)\b/gi, "à", "Préposition : « à » avec accent."],
    [/\bla (?:plupart|majorité) des \p{L}+ (?:est|a)\b/giu, "sont / ont", "« la plupart des » + nom pluriel : verbe au pluriel."],
];

const EN_ERRORS = [
    [/\b(?:could|should|would) of\b/gi, "could have", "« could of » est une faute pour « could have »."],
    [/\balot\b/gi, "a lot", "« a lot » s’écrit en deux mots."],
    [/\bdefinate(?:ly)?\b/gi, "definitely", "Orthographe : « definitely »."],
    [/\brecieve[sd]?\b/gi, "receive", "Orthographe : « receive »."],
    [/\bseperate(?:ly)?\b/gi, "separate", "Orthographe : « separate »."],
    [/\btheir is\b/gi, "there is", "« there is » (et non « their »)."],
];

const CONNECTORS = {
    fr: /\b(?:car|donc|en effet|par conséquent|ainsi|cependant|toutefois|néanmoins|pourtant|or|c'est pourquoi|en revanche|puisque|parce que|de ce fait|dès lors|certes|bien que)\b/gi,
    en: /\b(?:because|therefore|thus|however|although|since|consequently|hence|whereas|nevertheless|yet)\b/gi,
};

function push(list, type, text, start, end, message, severity = "mineur") {
    if (list.length >= 120) return;
    list.push({ type, severity, message, start, end, ...excerpt(text, start, end, 40) });
}

function analyzeWritingQuality({ text, lang }) {
    const issues = [];
    const total = wordCount(text);
    if (total < 30) return { status: "inconclusive", reason: "Texte trop court pour évaluer la qualité rédactionnelle.", issues: [] };

    // Punctuation and typography.
    const rules = [
        [/ +[,.](?!\.)/g, "ponctuation", "Espace en trop avant la virgule ou le point."],
        [/[,;:!?](?=[\p{L}])/gu, "ponctuation", "Il manque une espace après ce signe de ponctuation."],
        [/\.(?=\p{Lu}\p{Ll})/gu, "ponctuation", "Il manque une espace après le point."],
        [/ {2,}/g, "typographie", "Plusieurs espaces de suite."],
        [/([!?]){2,}|\.{4,}/g, "ponctuation", "Ponctuation répétée, à éviter dans un devoir."],
        [/\b(\p{L}{2,})\s+\1\b/giu, "répétition", "Mot répété deux fois de suite."],
        [/\b\p{Lu}{6,}\b/gu, "typographie", "Mot entièrement en majuscules."],
    ];
    if (lang === "fr") rules.push([/(?<=\p{L})[;!?](?=\s|$)/gu, "typographie", "En français, une espace précède « ; », « ! » et « ? »."]);
    for (const [re, type, message] of rules) {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
            // Not inside a URL, a number (3,5) or an acronym list.
            const around = text.slice(Math.max(0, m.index - 12), m.index + 12);
            if (/https?:|www\.|\d[,.]\d/.test(around)) continue;
            push(issues, type, text, m.index, m.index + m[0].length, message);
        }
    }

    // Frequent misspellings / errors.
    for (const [re, fix, why] of lang === "en" ? EN_ERRORS : FR_ERRORS) {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(text))) push(issues, "orthographe_grammaire", text, m.index, m.index + m[0].length, `${why} → ${fix}`, "important");
    }

    // Sentences.
    const sents = sentences(text);
    let long = 0;
    for (const s of sents) {
        const n = wordCount(s.text);
        if (/^\p{Ll}/u.test(s.text)) push(issues, "syntaxe", text, s.start, s.start + Math.min(s.text.length, 30), "La phrase commence par une minuscule.");
        if (n > 45) {
            long++;
            push(issues, "clarte", text, s.start, s.end, `Phrase très longue (${n} mots) : la découper rendrait l’explication plus claire.`);
        }
    }
    const lastChar = text.trim().slice(-1);
    if (!/[.!?…»")\]]/.test(lastChar)) push(issues, "ponctuation", text, text.length - 1, text.length, "Le texte ne se termine pas par une ponctuation.");

    // Paragraphs.
    const paras = paragraphs(text);
    const paragraphNotes = [];
    if (total > 300 && paras.length < 3) paragraphNotes.push("Le texte compte moins de 3 paragraphes : la structure (introduction, développement, conclusion) n’est pas visible.");
    const huge = paras.filter((p) => wordCount(p) > 250).length;
    if (huge) paragraphNotes.push(`${huge} paragraphe${huge > 1 ? "s dépassent" : " dépasse"} 250 mots : à découper pour la lisibilité.`);
    const single = paras.filter((p) => sentences(p).length === 1 && wordCount(p) < 25).length;
    if (paras.length >= 4 && single / paras.length > 0.4) paragraphNotes.push("Beaucoup de paragraphes d’une seule phrase courte : les idées sont peu développées.");

    // Argumentation: connectors that link ideas.
    const connectorCount = (text.match(CONNECTORS[lang] || CONNECTORS.fr) || []).length;
    const connectorsPer100 = (connectorCount / total) * 100;
    const argumentation =
        connectorsPer100 < 0.4
            ? "Peu de connecteurs logiques (car, donc, cependant…) : les liens entre les idées sont peu explicites."
            : "Les idées sont reliées par des connecteurs logiques.";

    // Score: errors weighted per 100 words, then structure and clarity.
    const weighted = issues.reduce((s, i) => s + (i.severity === "important" ? 3 : 1), 0);
    const per100 = (weighted / total) * 100;
    let score = 100 - Math.min(60, per100 * 8);
    score -= paragraphNotes.length * 6;
    score -= Math.min(10, (long / Math.max(sents.length, 1)) * 40);
    if (connectorsPer100 < 0.4) score -= 6;
    score = Math.round(clamp(score, 0, 100));

    const byType = {};
    for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;

    return {
        status: "ok",
        score,
        label: score >= 80 ? "Bonne qualité formelle" : score >= 60 ? "Qualité correcte, à améliorer" : score >= 40 ? "Nombreuses faiblesses" : "Qualité formelle insuffisante",
        counts: byType,
        issues,
        paragraphNotes,
        argumentation,
        stats: { words: total, sentences: sents.length, paragraphs: paras.length, averageSentence: Math.round(total / Math.max(sents.length, 1)), connectorsPer100: Number(connectorsPer100.toFixed(2)) },
        limitations: [
          "Orthographe et grammaire : contrôle partiel, limité aux fautes fréquentes d’une liste. Un correcteur complet demande un dictionnaire ou un service externe (non activé).",
        ],
    };
}

module.exports = { analyzeWritingQuality };
