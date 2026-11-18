// EDU-CHECK — settings of the homework-analysis module (see README.md).
// Every limit can be changed with an environment variable, none is required.

function intFromEnv(name, fallback, { min = 1, max = Infinity } = {}) {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

const MB = 1024 * 1024;

const CONFIG = Object.freeze({
    // An uploaded file (PDF, DOCX, TXT).
    maxFileBytes: intFromEnv("EDU_CHECK_MAX_FILE_MB", 5, { max: 25 }) * MB,
    // The text analysed, however it came in.
    maxWords: intFromEnv("EDU_CHECK_MAX_WORDS", 20000, { min: 500 }),
    // Below this, the AI-writing and style indicators say "non concluant".
    minWords: intFromEnv("EDU_CHECK_MIN_WORDS", 150, { min: 50 }),
    // Analyses (and the text they keep) are deleted after this many days.
    retentionDays: intFromEnv("EDU_CHECK_RETENTION_DAYS", 180, { min: 1, max: 3650 }),
    // Prior works for the style comparison, and texts in the comparison mode.
    maxPriorTexts: 5,
    maxCompareTexts: 5,
    // External source checks per analysis (Crossref / OpenAlex), and how
    // long a lookup is cached.
    maxSourceLookups: intFromEnv("EDU_CHECK_MAX_SOURCE_LOOKUPS", 15, { min: 0, max: 50 }),
    sourceCacheDays: 30,
    sourceTimeoutMs: 6000,
    // Looking references up in Crossref / OpenAlex (only the references are
    // sent, never the homework itself). EDU_CHECK_SOURCE_VERIFICATION=off
    // turns it off: references are then all marked "à vérifier".
    sourceVerification: process.env.EDU_CHECK_SOURCE_VERIFICATION !== "off",
});

// The academic levels a teacher can pick ("autre" takes a free label).
const LEVELS = Object.freeze({
    premiere_annee: "Première année",
    deuxieme_annee: "Deuxième année",
    troisieme_annee: "Troisième année",
    licence: "Licence",
    master: "Master",
    autre: "Autre niveau",
});

// The six independent dimensions — never merged into one score.
const CHECKS = Object.freeze(["ai", "quality", "sources", "coherence", "level", "style"]);

const DISCLAIMER =
    "Les résultats de cette analyse constituent des indicateurs et ne permettent pas d’établir avec certitude l’utilisation d’une intelligence artificielle. Une évaluation humaine reste indispensable.";

module.exports = { CONFIG, LEVELS, CHECKS, DISCLAIMER };
