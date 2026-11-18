const { LEVELS } = require("../config");

// Academic level — the homework's measurable features against indicative
// benchmarks for the level the teacher picked. Descriptive only: it is NEVER
// used in the AI-writing index (good writing is not a sign of AI).
//
// The benchmarks are rough, deliberately wide ranges, to be adjusted by each
// institution; they say "en dessous / dans / au-dessus des repères".

const BENCHMARKS = {
    premiere_annee: { sentence: [12, 24], vocabulary: 52, connectors: 0.4, references: 0 },
    deuxieme_annee: { sentence: [13, 26], vocabulary: 54, connectors: 0.5, references: 1 },
    troisieme_annee: { sentence: [14, 28], vocabulary: 56, connectors: 0.6, references: 2 },
    licence: { sentence: [14, 28], vocabulary: 57, connectors: 0.6, references: 3 },
    master: { sentence: [15, 32], vocabulary: 59, connectors: 0.7, references: 5 },
    autre: { sentence: [12, 30], vocabulary: 54, connectors: 0.5, references: 1 },
};

function analyzeLevel({ level, levelLabel, style, quality, sources }) {
    const bench = BENCHMARKS[level];
    if (!bench) return { status: "not_requested", reason: "Niveau non renseigné." };
    if (!style || quality?.status !== "ok") return { status: "inconclusive", reason: "Texte trop court pour situer le niveau." };
    const criteria = [];
    const add = (label, value, verdict, note) => criteria.push({ label, value, verdict, note });

    const s = Math.round(style.sentenceLength);
    add(
        "Longueur des phrases",
        `${s} mots en moyenne`,
        s < bench.sentence[0] ? "en_dessous" : s > bench.sentence[1] ? "au_dessus" : "conforme",
        s > bench.sentence[1] ? "Phrases longues : à ce niveau, viser la clarté plutôt que la longueur." : null,
    );
    const v = Math.round(style.vocabulary);
    add("Richesse du vocabulaire", `${v} mots différents sur 100`, v < bench.vocabulary ? "en_dessous" : "conforme", null);
    const c = quality.stats.connectorsPer100;
    add("Articulation des idées", `${c} connecteur(s) logique(s) pour 100 mots`, c < bench.connectors ? "en_dessous" : "conforme", null);
    if (sources?.status === "ok") {
        const n = sources.references.length;
        add(
            "Références",
            `${n} référence${n > 1 ? "s" : ""}`,
            n < bench.references ? "en_dessous" : "conforme",
            n < bench.references ? `On attend souvent au moins ${bench.references} référence(s) à ce niveau.` : null,
        );
    }

    const below = criteria.filter((x) => x.verdict === "en_dessous").length;
    return {
        status: "ok",
        level,
        levelLabel: levelLabel || LEVELS[level],
        summary:
            below === 0
                ? "Le devoir est dans les repères habituels de ce niveau."
                : below === 1
                  ? "Le devoir est globalement dans les repères, avec un point en dessous."
                  : `Le devoir est en dessous des repères sur ${below} points.`,
        criteria,
        limitations: [
            "Repères indicatifs et volontairement larges, à ajuster par l’établissement. Un bon niveau rédactionnel n’est pas un indice d’IA.",
        ],
    };
}

module.exports = { analyzeLevel, BENCHMARKS };
