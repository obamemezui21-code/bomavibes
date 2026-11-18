const { paragraphs, sentences, contentWords, wordCount, excerpt, clamp } = require("../text");

// AssignmentRelevanceService — does the homework answer the subject, and
// does it hold together? Measured on vocabulary, locally:
//   - topic: share of the subject's key words the homework uses, and
//     paragraphs that use none of them;
//   - introduction ↔ conclusion: do they speak of the same things;
//   - near-identical sentences (needless repetition);
//   - development paragraphs too short to develop an argument;
//   - examples (markers, figures, dates) present or absent.
// Contradictions can't be found reliably without a language model: said so.

const EXAMPLE_MARKERS = {
    fr: /\b(?:par exemple|notamment|comme le montre|tel(?:le)?s? que|à l'image de|c'est le cas de|prenons l'exemple|illustr\p{L}*|cas de)\b/giu,
    en: /\b(?:for example|for instance|such as|e\.g\.|as shown by|illustrat\p{L}*|in the case of)\b/giu,
};
const CONCLUSION_MARKERS = /\b(?:en conclusion|pour conclure|en somme|en définitive|finalement|in conclusion|to conclude|overall)\b/i;

const unique = (list) => [...new Set(list)];

function overlap(a, b) {
    const A = new Set(a);
    const B = new Set(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    return inter / Math.min(A.size, B.size);
}

function jaccard(a, b) {
    const A = new Set(a);
    const B = new Set(b);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
}

function analyzeRelevance({ text, lang, topic }) {
    const total = wordCount(text);
    if (total < 80) return { status: "inconclusive", reason: "Texte trop court pour évaluer la cohérence.", findings: [] };
    const l = lang || "fr";
    const paras = paragraphs(text);
    const findings = [];
    const add = (key, level, title, detail, passages = []) => findings.push({ key, level, title, detail, passages });

    // Topic.
    let topicResult = null;
    const topicWords = topic ? unique(contentWords(topic, l)) : [];
    if (topicWords.length >= 2) {
        const textWords = new Set(contentWords(text, l));
        const covered = topicWords.filter((w) => textWords.has(w));
        const coverage = covered.length / topicWords.length;
        const offTopic = paras
            .map((p, i) => ({ p, i, hits: contentWords(p, l).filter((w) => topicWords.includes(w)).length }))
            .filter((x) => x.hits === 0 && wordCount(x.p) >= 40);
        topicResult = { coverage: Math.round(coverage * 100), keyWords: topicWords.length, covered: covered.length, offTopicParagraphs: offTopic.length };
        if (coverage < 0.4) {
            add("topic", "attention", "Respect du sujet à vérifier", `Seuls ${covered.length} des ${topicWords.length} mots clés du sujet apparaissent dans le devoir.`);
        } else {
            add("topic", "ok", "Le vocabulaire du sujet est présent", `${covered.length} des ${topicWords.length} mots clés du sujet sont utilisés.`);
        }
        if (offTopic.length && paras.length >= 3) {
            add(
                "off_topic",
                "info",
                `${offTopic.length} paragraphe${offTopic.length > 1 ? "s" : ""} sans lien lexical visible avec le sujet`,
                "Ces paragraphes n’emploient aucun mot clé du sujet : hors-sujet possible, ou simple reformulation. À relire.",
                offTopic.slice(0, 3).map(({ p }) => {
                    const start = text.indexOf(p.slice(0, 40));
                    return start >= 0 ? excerpt(text, start, start + Math.min(p.length, 120), 0) : null;
                }).filter(Boolean),
            );
        }
    } else {
        add("topic", "info", "Sujet non renseigné", "Renseignez le sujet (la consigne) pour vérifier que le devoir y répond.");
    }

    // Structure: introduction, development, conclusion.
    if (paras.length >= 3) {
        const intro = contentWords(paras[0], l);
        const conclusion = contentWords(paras[paras.length - 1], l);
        const link = overlap(intro, conclusion);
        const hasConclusion = CONCLUSION_MARKERS.test(paras[paras.length - 1]) || paras.length >= 4;
        if (link < 0.15) add("intro_conclusion", "attention", "Introduction et conclusion peu liées", "La conclusion reprend très peu des notions annoncées en introduction.");
        else add("intro_conclusion", "ok", "Introduction et conclusion cohérentes", `La conclusion reprend ${Math.round(link * 100)} % des notions de l’introduction.`);
        if (!hasConclusion) add("structure", "info", "Conclusion peu visible", "Aucune formule de conclusion repérée dans le dernier paragraphe.");
    } else if (total > 250) {
        add("structure", "attention", "Structure peu visible", "Le devoir ne se découpe pas en introduction, développement et conclusion distincts.");
    }

    // Needless repetitions: near-identical sentences.
    const sents = sentences(text).filter((s) => wordCount(s.text) >= 8);
    const bags = sents.map((s) => contentWords(s.text, l));
    const repeats = [];
    for (let i = 0; i < sents.length && repeats.length < 5; i++) {
        for (let j = i + 1; j < sents.length; j++) {
            if (bags[i].length >= 4 && jaccard(bags[i], bags[j]) >= 0.7) {
                repeats.push([sents[i], sents[j]]);
                break;
            }
        }
    }
    if (repeats.length) {
        add(
            "repetitions",
            "attention",
            `${repeats.length} idée${repeats.length > 1 ? "s" : ""} répétée${repeats.length > 1 ? "s" : ""} presque mot pour mot`,
            "Des phrases très proches reviennent : répétitions inutiles, ou paragraphes assemblés.",
            repeats.flatMap(([a, b]) => [excerpt(text, a.start, a.end, 0), excerpt(text, b.start, b.end, 0)]).slice(0, 4),
        );
    }

    // Underdeveloped arguments.
    const development = paras.length >= 3 ? paras.slice(1, -1) : [];
    const thin = development.filter((p) => wordCount(p) < 40);
    if (development.length && thin.length / development.length >= 0.5) {
        add("thin_arguments", "attention", "Arguments peu développés", `${thin.length} paragraphe${thin.length > 1 ? "s" : ""} du développement font moins de 40 mots.`);
    }

    // Examples.
    const examples = (text.match(EXAMPLE_MARKERS[l] || EXAMPLE_MARKERS.fr) || []).length;
    const figures = (text.match(/\b(?:1[5-9]|20)\d{2}\b|\b\d+(?:[,.]\d+)?\s?%/g) || []).length;
    if (examples + figures === 0 && total > 300) add("examples", "attention", "Aucun exemple repéré", "Pas d’exemple, de chiffre ni de date pour appuyer les idées.");
    else add("examples", "ok", "Exemples présents", `${examples} marqueur${examples > 1 ? "s" : ""} d’exemple, ${figures} chiffre${figures > 1 ? "s" : ""} ou date${figures > 1 ? "s" : ""}.`);

    const attention = findings.filter((f) => f.level === "attention").length;
    const score = Math.round(clamp(1 - attention * 0.18 - (topicResult && topicResult.coverage < 40 ? 0.15 : 0)) * 100);
    return {
        status: "ok",
        score,
        label: score >= 80 ? "Contenu cohérent" : score >= 60 ? "Cohérence correcte, quelques points à revoir" : "Cohérence à revoir",
        topic: topicResult,
        findings,
        limitations: [
            "Analyse lexicale : elle repère des mots et des structures, pas le sens. La pertinence des idées reste à juger par l’enseignant.",
            "Contradictions : non détectées automatiquement (cela demanderait un modèle de langage, non activé).",
        ],
    };
}

module.exports = { analyzeRelevance };
