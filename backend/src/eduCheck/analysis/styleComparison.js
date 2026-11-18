const { sentences, paragraphs, words, wordCount, mean, stdev, contentWords, STOPWORDS } = require("../text");

// StudentStyleComparisonService — the measurable habits of a text, and how
// two texts (or a text and earlier works) differ. Changes are shown, never
// read as fraud: progress, another subject or another exercise change a
// style too.

const FEATURES = [
    ["sentenceLength", "Longueur moyenne des phrases (mots)"],
    ["sentenceSpread", "Variation de la longueur des phrases"],
    ["wordLength", "Longueur moyenne des mots (lettres)"],
    ["vocabulary", "Richesse du vocabulaire (mots différents / 100)"],
    ["commas", "Virgules par phrase"],
    ["paragraphLength", "Longueur moyenne des paragraphes (mots)"],
    ["subordinates", "Subordonnées par phrase"],
    ["firstPerson", "Emploi de la 1re personne (‰ des mots)"],
    ["questions", "Questions (% des phrases)"],
];

const SUBORDINATE = /\b(?:que|qui|dont|où|lorsque|puisque|parce que|bien que|alors que|tandis que|si|that|which|who|whom|whose|when|because|although|while|if)\b/gi;
const FIRST_PERSON = /\b(?:je|j'|me|moi|mon|ma|mes|i|me|my|mine)\b/gi;

// Average share of distinct words per 100-word window (independent of length).
function vocabularyRichness(ws) {
    if (ws.length < 100) return ws.length ? (new Set(ws).size / ws.length) * 100 : 0;
    const scores = [];
    for (let i = 0; i + 100 <= ws.length; i += 50) scores.push(new Set(ws.slice(i, i + 100)).size);
    return mean(scores);
}

function styleProfile(text, lang = "fr") {
    const sents = sentences(text);
    const lengths = sents.map((s) => wordCount(s.text));
    const ws = words(text.toLowerCase());
    const paras = paragraphs(text);
    const stop = STOPWORDS[lang] || STOPWORDS.fr;
    // Function-word profile: how often each common little word comes up.
    const functionWords = {};
    for (const w of ws) if (stop.has(w)) functionWords[w] = (functionWords[w] || 0) + 1;
    for (const k of Object.keys(functionWords)) functionWords[k] /= Math.max(ws.length, 1);
    return {
        words: ws.length,
        sentenceLength: mean(lengths),
        sentenceSpread: stdev(lengths),
        wordLength: mean(ws.map((w) => w.length)),
        vocabulary: vocabularyRichness(ws),
        commas: (text.match(/,/g) || []).length / Math.max(sents.length, 1),
        paragraphLength: mean(paras.map(wordCount)),
        subordinates: (text.match(SUBORDINATE) || []).length / Math.max(sents.length, 1),
        firstPerson: ((text.match(FIRST_PERSON) || []).length / Math.max(ws.length, 1)) * 1000,
        questions: (sents.filter((s) => s.text.endsWith("?")).length / Math.max(sents.length, 1)) * 100,
        functionWords,
        topWords: topContentWords(text, lang, 15),
    };
}

function topContentWords(text, lang, n) {
    const counts = new Map();
    for (const w of contentWords(text, lang)) counts.set(w, (counts.get(w) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function cosine(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const k of keys) {
        const x = a[k] || 0;
        const y = b[k] || 0;
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const round = (v) => Math.round(v * 10) / 10;

// The features of `current` against the average of `others`.
function compareProfiles(current, others) {
    const reference = {};
    for (const [key] of FEATURES) reference[key] = mean(others.map((o) => o[key]));
    const changes = FEATURES.map(([key, label]) => {
        const before = reference[key];
        const now = current[key];
        const relative = before ? (now - before) / before : now ? 1 : 0;
        return { key, label, before: round(before), now: round(now), change: Math.round(relative * 100) };
    });
    const functionSimilarity = mean(others.map((o) => cosine(current.functionWords, o.functionWords)));
    // Features within ±25 % count as similar; beyond, less and less.
    const featureSimilarity = mean(changes.map((c) => Math.max(0, 1 - Math.max(0, Math.abs(c.change) - 25) / 75)));
    const similarity = Math.round((functionSimilarity * 0.5 + featureSimilarity * 0.5) * 100);
    const notable = changes.filter((c) => Math.abs(c.change) >= 40 && Math.abs(c.now - c.before) >= 1);
    return { similarity, changes, notable };
}

/**
 * Style against earlier works of the same student.
 * @param {{ text: string, lang: string|null, priorTexts: string[] }} input
 */
function analyzeStyle({ text, lang, priorTexts = [] }) {
    const usable = priorTexts.filter((t) => wordCount(t) >= 150);
    if (!priorTexts.length) return { status: "not_requested", reason: "Aucun travail antérieur fourni." };
    if (!usable.length) return { status: "inconclusive", reason: "Les travaux antérieurs fournis sont trop courts (150 mots minimum chacun)." };
    if (wordCount(text) < 150) return { status: "inconclusive", reason: "Le devoir est trop court pour comparer le style." };
    const l = lang || "fr";
    const current = styleProfile(text, l);
    const priors = usable.map((t) => styleProfile(t, l));
    const { similarity, changes, notable } = compareProfiles(current, priors);
    const newWords = current.topWords.filter((w) => !priors.some((p) => p.topWords.includes(w)));
    return {
        status: "ok",
        similarity,
        label: similarity >= 75 ? "Style proche des travaux antérieurs" : similarity >= 55 ? "Quelques différences de style" : "Différences de style importantes",
        priorCount: usable.length,
        changes,
        notable: notable.map((c) => `${c.label} : ${c.before} → ${c.now} (${c.change > 0 ? "+" : ""}${c.change} %)`),
        newVocabulary: newWords.slice(0, 10),
        limitations: [
            "Un style évolue avec les progrès, la matière et le type d’exercice : un écart appelle un échange avec l’étudiant, pas une conclusion.",
            usable.length < 3 ? "Moins de 3 travaux antérieurs : la référence de style est fragile." : null,
        ].filter(Boolean),
    };
}

/**
 * Comparison mode: 2 to 5 texts side by side.
 * @param {{ texts: { label: string, text: string }[], lang?: string }} input
 */
function compareTexts({ texts, lang }) {
    const l = lang || "fr";
    const profiles = texts.map((t) => ({ label: t.label, profile: styleProfile(t.text, l), tooShort: wordCount(t.text) < 150 }));
    const pairs = [];
    for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
            const { similarity, notable } = compareProfiles(profiles[j].profile, [profiles[i].profile]);
            const a = new Set(profiles[i].profile.topWords);
            const b = new Set(profiles[j].profile.topWords);
            pairs.push({
                a: profiles[i].label,
                b: profiles[j].label,
                similarity,
                notable: notable.map((c) => `${c.label} : ${c.before} → ${c.now} (${c.change > 0 ? "+" : ""}${c.change} %)`),
                sharedVocabulary: [...a].filter((w) => b.has(w)),
                onlyA: [...a].filter((w) => !b.has(w)).slice(0, 8),
                onlyB: [...b].filter((w) => !a.has(w)).slice(0, 8),
            });
        }
    }
    return {
        features: FEATURES.map(([key, label]) => ({ key, label, values: profiles.map((p) => round(p.profile[key])) })),
        labels: profiles.map((p) => p.label),
        structure: profiles.map((p) => ({ label: p.label, words: p.profile.words, tooShort: p.tooShort })),
        pairs,
        limitations: ["Comparaison statistique du style : des textes proches peuvent avoir des auteurs différents, et l’inverse."],
    };
}

module.exports = { analyzeStyle, compareTexts, styleProfile };
