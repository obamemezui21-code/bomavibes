const { CONFIG } = require("../config");
const { sentences, paragraphs, words, wordCount, variation, clamp, excerpt, STOPWORDS } = require("../text");

// AIWritingAnalysisService — features often found in AI-assisted writing.
//
// Each indicator is measured on its own and shown with the passages behind
// it. None is a proof: an academic text is naturally structured, a careful
// student writes evenly, a corrector smooths a text out. Hence:
//   - one indicator alone never raises the index past 40 (it needs two
//     converging indicators to go higher);
//   - grammar quality is NOT an indicator (a correct text is not an AI text);
//   - in academic levels, a regular structure counts for less;
//   - too short, unknown language, too few sentences: "non concluant".
// The index is a heuristic, not a probability.

// Formulas common in generated text, by language. Each match is shown.
const GENERIC = {
    fr: [
        /il est (?:important|essentiel|crucial|primordial|fondamental) de (?:noter|souligner|comprendre|rappeler|garder à l'esprit)/gi,
        /joue(?:nt)? un rôle (?:crucial|essentiel|clé|majeur|déterminant|central|prépondérant)/gi,
        /dans un monde en (?:constante|perpétuelle) (?:évolution|mutation)/gi,
        /à l'ère (?:du numérique|de la mondialisation|actuelle)/gi,
        /(?:un|une) (?:enjeu|défi) (?:majeur|crucial|de taille|incontournable)/gi,
        /il convient de (?:souligner|noter|rappeler|mentionner)/gi,
        /en (?:somme|définitive|fin de compte)/gi,
        /(?:un|une) véritable (?:levier|pilier|atout|tremplin|catalyseur)/gi,
        /(?:au cœur|au centre) (?:de|des) (?:enjeux|débats|préoccupations)/gi,
        /de manière (?:significative|considérable|durable|holistique)/gi,
        /(?:ouvre|ouvrent) la voie à/gi,
        /(?:force|il faut) est de constater/gi,
        /permet(?:tent)? (?:ainsi )?de mieux comprendre/gi,
        /(?:une|la) (?:approche|vision) (?:holistique|globale et intégrée)/gi,
        /(?:favoriser|promouvoir|renforcer) (?:l'inclusion|la cohésion|la synergie)/gi,
        /(?:en|pour) conclusion, il (?:apparaît|ressort|est clair)/gi,
        /(?:riche|vaste) et complexe/gi,
        /(?:naviguer|s'orienter) dans (?:la|les) complexit/gi,
        /(?:un|le) (?:paysage|panorama) (?:en mutation|en évolution|complexe)/gi,
        /non seulement [^.]{3,60} mais (?:aussi|également)/gi,
    ],
    en: [
        /it is (?:important|essential|crucial|worth) (?:to note|noting|to remember|to highlight)/gi,
        /plays? an? (?:crucial|pivotal|key|vital|significant) role/gi,
        /in today's (?:fast-paced|ever-changing|digital|modern) world/gi,
        /\bdelve(?:s|d)? (?:into|deeper)/gi,
        /\b(?:rich )?tapestry\b/gi,
        /a testament to/gi,
        /navigat(?:e|ing) the complexit/gi,
        /in (?:conclusion|summary), it is (?:clear|evident)/gi,
        /(?:ever-evolving|ever-changing) (?:landscape|world)/gi,
        /(?:foster|fostering) (?:a sense of|inclusivity|collaboration)/gi,
        /not only [^.]{3,60} but also/gi,
        /(?:unlock|harness) the (?:full )?potential/gi,
        /(?:multifaceted|holistic) (?:approach|nature|issue)/gi,
        /serves? as a (?:reminder|catalyst|cornerstone)/gi,
    ],
};

// Paragraph openers that mark a regular, scaffolded progression.
const TRANSITIONS = {
    fr: /^(?:tout d'abord|d'abord|premièrement|en premier lieu|ensuite|deuxièmement|en second lieu|de plus|par ailleurs|en outre|de surcroît|enfin|finalement|en conclusion|pour conclure|ainsi|cependant|néanmoins|toutefois|d'une part|d'autre part|en effet|dans un premier temps|dans un second temps|dans un dernier temps)\b/i,
    en: /^(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|moreover|furthermore|additionally|in addition|however|nevertheless|finally|lastly|in conclusion|to conclude|overall|consequently|therefore)\b/i,
};

const ACADEMIC_LEVELS = new Set(["licence", "master", "troisieme_annee"]);

function band(score) {
    if (score <= 20) return { band: "faible", label: "Indice faible" };
    if (score <= 40) return { band: "limite", label: "Indice limité" };
    if (score <= 60) return { band: "modere", label: "Indice modéré" };
    if (score <= 80) return { band: "eleve", label: "Indice élevé" };
    return { band: "tres_eleve", label: "Indice très élevé" };
}

function passageOf(text, s) {
    return { ...excerpt(text, s.start, s.end, 60), start: s.start, end: s.end };
}

// 1. Sentence lengths that hardly vary.
function sentenceUniformity(text, sents) {
    if (sents.length < 10) return null;
    const lengths = sents.map((s) => wordCount(s.text));
    const cv = variation(lengths);
    // The 4 consecutive sentences of the most similar length, as an example.
    let best = 0;
    let bestSpread = Infinity;
    for (let i = 0; i + 4 <= lengths.length; i++) {
        const w = lengths.slice(i, i + 4);
        const spread = Math.max(...w) - Math.min(...w);
        if (spread < bestSpread) {
            bestSpread = spread;
            best = i;
        }
    }
    const run = sents.slice(best, best + 4);
    return {
        key: "sentence_uniformity",
        label: "Uniformité de la longueur des phrases",
        value: clamp((0.6 - cv) / 0.35),
        weight: 1,
        observed: `Écart relatif des longueurs de phrases : ${cv.toFixed(2)} (${lengths.length} phrases, ${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)} mots en moyenne).`,
        explanation:
            "Un texte rédigé d’un seul jet mêle souvent phrases courtes et longues (écart relatif fréquemment supérieur à 0,6). Une longueur très régulière est une caractéristique fréquente des textes générés, mais aussi des textes très travaillés ou relus.",
        passages: cv < 0.45 ? [{ ...excerpt(text, run[0].start, run[run.length - 1].end, 30), start: run[0].start, end: run[run.length - 1].end }] : [],
    };
}

// 2. Many sentences opening the same way.
function repeatedOpenings(text, sents, lang) {
    if (sents.length < 10) return null;
    const opening = (s) => words(s.text.toLowerCase()).slice(0, 2).join(" ");
    const counts = new Map();
    for (const s of sents) counts.set(opening(s), (counts.get(opening(s)) || 0) + 1);
    const repeated = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    const share = repeated.reduce((sum, [, n]) => sum + n, 0) / sents.length;
    const top = repeated[0]?.[0];
    return {
        key: "repeated_openings",
        label: "Répétition des structures de phrases",
        value: clamp((share - 0.15) / 0.35),
        weight: 0.8,
        observed: repeated.length
            ? `${Math.round(share * 100)} % des phrases commencent par une tournure répétée au moins 3 fois (la plus fréquente : « ${top} », ${repeated[0][1]} fois).`
            : "Les débuts de phrases sont variés.",
        explanation:
            "Des phrases qui s’ouvrent toutes de la même façon donnent un rythme mécanique. Cela peut venir d’un modèle de langage, mais aussi d’une consigne qui impose un plan ou d’habitudes d’écriture.",
        passages: top
            ? sents
                  .filter((s) => opening(s) === top)
                  .slice(0, 3)
                  .map((s) => passageOf(text, s))
            : [],
        lang,
    };
}

// 3. Generic, ready-made formulas.
function genericPhrases(text, lang, totalWords) {
    const found = [];
    for (const re of GENERIC[lang] || []) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) && found.length < 40) found.push({ start: m.index, end: m.index + m[0].length, phrase: m[0] });
    }
    const distinct = new Set(found.map((f) => f.phrase.toLowerCase())).size;
    const perThousand = (found.length / Math.max(totalWords, 1)) * 1000;
    return {
        key: "generic_phrases",
        label: "Formulations génériques",
        // A single formula proves nothing: it takes several different ones.
        value: distinct < 2 ? 0 : clamp(perThousand / 6),
        weight: 1,
        observed: found.length
            ? `${found.length} formulation${found.length > 1 ? "s" : ""} générique${found.length > 1 ? "s" : ""} (${distinct} différente${distinct > 1 ? "s" : ""}), soit ${perThousand.toFixed(1)} pour 1 000 mots.`
            : "Aucune des formulations génériques suivies n’a été trouvée.",
        explanation:
            "Ces tournures toutes faites (« joue un rôle crucial », « dans un monde en constante évolution »…) sont très fréquentes dans les textes générés. Elles existent aussi dans les copies d’élèves et les manuels : c’est leur accumulation qui est notable.",
        passages: found.slice(0, 6).map((f) => ({ ...excerpt(text, f.start, f.end, 60), start: f.start, end: f.end })),
    };
}

// 4. Paragraphs that all open with a transition word.
function transitionRegularity(text, paras, lang, level) {
    if (paras.length < 4) return null;
    const re = TRANSITIONS[lang] || TRANSITIONS.fr;
    const marked = paras.filter((p) => re.test(p.toLowerCase()));
    const share = marked.length / paras.length;
    const academic = ACADEMIC_LEVELS.has(level);
    return {
        key: "transition_regularity",
        label: "Transitions très régulières",
        value: clamp((share - 0.45) / 0.45),
        // Academic writing is taught to be scaffolded: counts for less there.
        weight: academic ? 0.4 : 0.8,
        observed: `${marked.length} paragraphe${marked.length > 1 ? "s" : ""} sur ${paras.length} commence${marked.length > 1 ? "nt" : ""} par un mot de transition (« Tout d’abord », « De plus », « Enfin »…).`,
        explanation:
            "Un enchaînement parfaitement balisé de paragraphe en paragraphe est typique des textes générés, mais c’est aussi ce que l’on enseigne en méthodologie" +
            (academic ? " : à ce niveau, cet indicateur compte donc moins." : "."),
        passages: marked.slice(0, 4).map((p) => {
            const start = text.indexOf(p.slice(0, 40));
            return start >= 0 ? { ...excerpt(text, start, start + Math.min(p.length, 90), 0), start, end: start + Math.min(p.length, 90) } : null;
        }).filter(Boolean),
    };
}

// 5. Paragraphs all of the same size.
function paragraphUniformity(paras) {
    if (paras.length < 4) return null;
    const lengths = paras.map(wordCount);
    const cv = variation(lengths);
    return {
        key: "paragraph_uniformity",
        label: "Paragraphes de taille très homogène",
        value: clamp((0.45 - cv) / 0.3),
        weight: 0.6,
        observed: `Écart relatif des longueurs de paragraphes : ${cv.toFixed(2)} (${paras.length} paragraphes, de ${Math.min(...lengths)} à ${Math.max(...lengths)} mots).`,
        explanation: "Des paragraphes presque tous de la même longueur traduisent une construction très homogène. Un plan imposé ou une forte relecture produisent le même effet.",
        passages: [],
    };
}

// 6. The same expressions coming back.
function repeatedExpressions(text, lang) {
    const stop = STOPWORDS[lang] || STOPWORDS.fr;
    const ws = [];
    const re = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
    let m;
    while ((m = re.exec(text))) ws.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
    const grams = new Map();
    for (let i = 0; i + 3 <= ws.length; i++) {
        const tri = ws.slice(i, i + 3);
        // At least two words that carry meaning: "de la société" is not an expression.
        if (tri.filter((t) => !stop.has(t.w) && t.w.length > 2).length < 2) continue;
        const key = tri.map((t) => t.w).join(" ");
        if (!grams.has(key)) grams.set(key, []);
        grams.get(key).push({ start: tri[0].start, end: tri[2].end });
    }
    const repeated = [...grams.entries()].filter(([, at]) => at.length >= 3).sort((a, b) => b[1].length - a[1].length);
    return {
        key: "repeated_expressions",
        label: "Expressions répétées",
        value: clamp((repeated.length - 1) / 4),
        weight: 0.6,
        observed: repeated.length
            ? `${repeated.length} expression${repeated.length > 1 ? "s" : ""} de 3 mots reviennent au moins 3 fois (ex. « ${repeated[0][0]} », ${repeated[0][1].length} fois).`
            : "Pas d’expression répétée de façon notable.",
        explanation:
            "Le retour fréquent des mêmes expressions peut venir d’un texte généré puis assemblé. C’est aussi normal pour les termes du sujet lui-même : à lire au cas par cas.",
        passages: repeated.slice(0, 3).map(([, at]) => ({ ...excerpt(text, at[0].start, at[0].end, 50), start: at[0].start, end: at[0].end })),
    };
}

// 7. A style far from the student's earlier works (styleComparison.js).
function styleShift(style) {
    if (!style || style.status !== "ok") return null;
    return {
        key: "style_shift",
        label: "Écart avec les travaux antérieurs",
        value: clamp((75 - style.similarity) / 45),
        weight: 1,
        observed: `Similarité stylistique avec les travaux antérieurs : ${style.similarity}/100.`,
        explanation:
            "Un changement net de style par rapport aux devoirs précédents du même étudiant mérite un échange avec lui. Il peut aussi s’expliquer par des progrès, une autre matière ou un autre type d’exercice.",
        passages: [],
    };
}

/**
 * @param {{ text: string, lang: string|null, level?: string, style?: object }} input
 */
function analyzeAiWriting({ text, lang, level, style }) {
    const totalWords = wordCount(text);
    const sents = sentences(text);
    const paras = paragraphs(text);
    const limitations = [];
    if (!lang) return inconclusive("La langue du texte n’a pas été reconnue (seuls le français et l’anglais sont pris en charge).");
    if (totalWords < CONFIG.minWords) return inconclusive(`Texte trop court (${totalWords} mots ; il en faut au moins ${CONFIG.minWords}).`);
    if (sents.length < 8) return inconclusive(`Trop peu de phrases (${sents.length}) pour mesurer le style de façon fiable.`);

    const signals = [
        sentenceUniformity(text, sents),
        repeatedOpenings(text, sents, lang),
        genericPhrases(text, lang, totalWords),
        transitionRegularity(text, paras, lang, level),
        paragraphUniformity(paras),
        repeatedExpressions(text, lang),
        styleShift(style),
    ].filter(Boolean);

    if (signals.length < 3) return inconclusive("Pas assez d’éléments mesurables (texte trop peu structuré en phrases et paragraphes).");

    const weightSum = signals.reduce((s, x) => s + x.weight, 0);
    let score = Math.round((signals.reduce((s, x) => s + x.value * x.weight, 0) / weightSum) * 100);
    const strong = signals.filter((s) => s.value >= 0.5).length;
    if (strong < 2 && score > 40) {
        score = 40;
        limitations.push("Un seul indicateur est marqué : l’indice est plafonné à 40, un élément isolé ne suffit pas.");
    }
    const reliability = totalWords < 400 ? "faible" : totalWords < 1000 ? "moyenne" : "correcte";
    if (reliability !== "correcte") limitations.push(`Texte de ${totalWords} mots : fiabilité ${reliability} des mesures statistiques.`);
    if (!style) limitations.push("Aucun travail antérieur fourni : la cohérence avec le style habituel de l’étudiant n’a pas été évaluée.");
    if (ACADEMIC_LEVELS.has(level)) limitations.push("Niveau académique : une structure régulière y est attendue et a été moins prise en compte.");
    limitations.push("La qualité de l’orthographe et de la grammaire n’entre pas dans cet indice : un texte correct n’est pas un texte généré.");

    return {
        status: "ok",
        score,
        ...band(score),
        reliability,
        signals: signals.map((s) => ({ ...s, value: Math.round(s.value * 100) })).sort((a, b) => b.value - a.value),
        observations: signals.filter((s) => s.value >= 0.4).map((s) => s.label),
        limitations,
    };
}

function inconclusive(reason) {
    return { status: "inconclusive", reason, signals: [], limitations: [] };
}

module.exports = { analyzeAiWriting, band };
