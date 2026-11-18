// Text tools shared by every EDU-CHECK analysis: words, sentences,
// paragraphs, language. Plain functions, no I/O: the homework text is only
// ever data here, never an instruction to anything.

const ABBREVIATIONS = new Set([
    "m", "mme", "mlle", "dr", "pr", "st", "ste", "etc", "cf", "ex", "p", "pp", "vol", "éd", "ed", "fig", "chap",
    "n°", "no", "art", "al", "mr", "mrs", "ms", "vs", "e.g", "i.e", "env", "av", "apr", "j.-c", "op", "cit", "ibid",
]);

// "l’homme" → "l'homme"; odd spaces → plain spaces; no control characters.
function normalizeText(text) {
    return String(text ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/[‘’ʼ]/g, "'")
        .replace(/[   ]/g, " ")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

function words(text) {
    return String(text).match(WORD_RE) || [];
}

function wordCount(text) {
    return words(text).length;
}

function paragraphs(text) {
    return String(text)
        .split(/\n\s*\n|\n(?=\s*(?:[-–•*]|\d+[.)])\s)/)
        .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
        .filter((p) => wordCount(p) > 0);
}

// Section titles ("Introduction", "II. Les limites") left out: they are not
// prose, and would distort sentence and paragraph measures.
function withoutHeadings(text) {
    return String(text)
        .split(/\n\s*\n/)
        .filter((block) => {
            const t = block.trim();
            return !(wordCount(t) <= 6 && !/[.!?…:;»"]$/.test(t) && !t.includes("\n"));
        })
        .join("\n\n");
}

// Sentences with their position in the text, for showing passages in context.
function sentences(text) {
    const out = [];
    const src = String(text);
    const re = /[^.!?…]+(?:[.!?…]+["»”)\]]*|$)/g;
    let start = null;
    let buffer = "";
    let m;
    while ((m = re.exec(src))) {
        if (!m[0]) {
            re.lastIndex++;
            continue;
        }
        if (start === null) start = m.index;
        buffer += m[0];
        const lastWord = (buffer.trim().match(/([\p{L}.°-]+)\.$/u) || [])[1]?.toLowerCase();
        const next = src.slice(re.lastIndex).match(/^\s*(\S)/u)?.[1];
        // "M. Dupont", "p. 12": not the end of a sentence.
        const isAbbreviation = lastWord && (ABBREVIATIONS.has(lastWord.replace(/\.$/, "")) || /^\p{Lu}$/u.test(lastWord));
        const nextStartsLower = next && /\p{Ll}|\d/u.test(next);
        if ((isAbbreviation || nextStartsLower) && re.lastIndex < src.length) continue;
        const raw = buffer;
        const trimmed = raw.trim();
        if (wordCount(trimmed) > 0) {
            const offset = start + raw.indexOf(trimmed[0]);
            out.push({ text: trimmed.replace(/\s+/g, " "), start: offset, end: offset + trimmed.length });
        }
        start = null;
        buffer = "";
    }
    return out;
}

// French and English function words: the language and the style profile.
const STOPWORDS = {
    fr: new Set(
        "le la les un une des du de d l et ou mais donc or ni car que qui quoi dont où ce cet cette ces se sa son ses leur leurs il elle ils elles on nous vous je tu me te lui y en ne pas plus est sont été être avoir a ont au aux pour par sur dans avec sans sous entre comme si aussi très tout tous toute toutes cela ceci ça qu s c n j m t".split(
            " ",
        ),
    ),
    en: new Set(
        "the a an and or but so of to in on at for with by from as is are was were be been being have has had it its this that these those they them their he she we you i not no do does did can could will would should may might there which who whom what when where why how all any each more most other some such than too very".split(
            " ",
        ),
    ),
};

// "fr", "en", or null when neither is clear (the analysis says so).
function detectLanguage(text) {
    const ws = words(text.toLowerCase()).slice(0, 3000);
    if (ws.length < 20) return null;
    const ratio = (lang) => ws.filter((w) => STOPWORDS[lang].has(w)).length / ws.length;
    const fr = ratio("fr");
    const en = ratio("en");
    if (Math.max(fr, en) < 0.12) return null;
    return fr >= en ? "fr" : "en";
}

// Content words, lowercased and lightly stemmed, for topic and vocabulary comparisons.
function contentWords(text, lang = "fr") {
    const stop = STOPWORDS[lang] || STOPWORDS.fr;
    return words(text.toLowerCase())
        .map((w) => w.replace(/^(?:l|d|j|m|n|s|t|c|qu)'/, ""))
        .filter((w) => w.length > 3 && !stop.has(w) && !/^\d+$/.test(w))
        .map(stem);
}

// Crude suffix stripping, good enough to match "éducation" / "éducatif".
function stem(w) {
    return w
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/(?:ements?|ations?|ateurs?|atrices?|issements?|ements|ments?|ités?|ives?|ifs?|euses?|eux|ales?|aux|iques?|ismes?|istes?|ing|ed|ly|ies|es|s)$/, "")
        .slice(0, 12);
}

function mean(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdev(values) {
    if (values.length < 2) return 0;
    const m = mean(values);
    return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

// Coefficient of variation: how much lengths vary, whatever their size.
function variation(values) {
    const m = mean(values);
    return m ? stdev(values) / m : 0;
}

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

// A short passage around [start, end) of the text, for the teacher to read.
function excerpt(text, start, end, around = 80) {
    const from = Math.max(0, start - around);
    const to = Math.min(text.length, end + around);
    return {
        before: (from > 0 ? "…" : "") + text.slice(from, start).replace(/\s+/g, " "),
        match: text.slice(start, end).replace(/\s+/g, " "),
        after: text.slice(end, to).replace(/\s+/g, " ") + (to < text.length ? "…" : ""),
    };
}

module.exports = {
    normalizeText,
    words,
    wordCount,
    paragraphs,
    withoutHeadings,
    sentences,
    detectLanguage,
    contentWords,
    stem,
    STOPWORDS,
    mean,
    stdev,
    variation,
    clamp,
    excerpt,
};
