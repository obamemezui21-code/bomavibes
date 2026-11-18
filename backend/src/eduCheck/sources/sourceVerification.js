const crypto = require("crypto");
const { CONFIG } = require("../config");
const { sentences, excerpt, words } = require("../text");

// SourceVerificationService — the homework's references and quotations.
//
// Found locally: bibliography entries, DOIs, links, in-text citations
// "(Dupont, 2019)", quotations « … ». Reported: incomplete references,
// quotations with no reference, citations absent from the bibliography.
//
// Checked externally, when possible and allowed (CONFIG.sourceVerification):
//   - a DOI with Crossref (api.crossref.org, free);
//   - a title with OpenAlex (api.openalex.org, free).
// Only the reference itself is sent, never the homework. Links the student
// gives are NEVER fetched (no request to an address chosen by a document):
// they are marked "à vérifier manuellement". A source not found is not a
// fake source (local book, report, document outside these databases): it
// is shown as such, and nothing is ever made up.

const HEADING = /^\s*(?:\d+[.)]\s*)?(?:bibliographie|r[ée]f[ée]rences(?: bibliographiques)?|sources(?: consult[ée]es)?|webographie|sitographie|ouvrages cit[ée]s|bibliography|references|works cited)\s*:?\s*$/im;
const DOI_RE = /\b10\.\d{4,9}\/[^\s"<>«»,;]+[^\s"<>«»,;.)]/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"«»]+[^\s<>"«».,;)]/gi;
const YEAR_RE = /\b(1[6-9]\d{2}|20\d{2})\b/;
const IN_TEXT = /\(([\p{Lu}][\p{L}'-]+(?:\s+(?:et al\.?|(?:et|and|&)\s+[\p{Lu}][\p{L}'-]+))?),?\s+((?:1[6-9]|20)\d{2})[a-z]?(?:,\s*p\.?\s*\d+(?:-\d+)?)?\)/gu;
// "Kouassi (2018)": the author named in the sentence, the year in brackets.
const NARRATIVE = /\b([\p{Lu}][\p{L}'-]{2,})(?:\s+et al\.?)?\s+\(((?:1[6-9]|20)\d{2})[a-z]?(?:,\s*p\.?\s*\d+(?:-\d+)?)?\)/gu;
const QUOTE =/«\s*([^»]{40,600}?)\s*»|"([^"]{40,600}?)"|“([^”]{40,600}?)”/g;

function normalizeTitle(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);
}

function titleSimilarity(a, b) {
    const A = new Set(normalizeTitle(a));
    const B = new Set(normalizeTitle(b));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    return (2 * inter) / (A.size + B.size);
}

// One bibliography line → its parts, as far as they can be told apart.
function parseEntry(raw) {
    const line = raw.replace(/^\s*(?:\[\d+\]|\d+[.)]|[-–•*])\s*/, "").trim();
    const doi = (line.match(DOI_RE) || [])[0] || null;
    // A doi.org link is the DOI itself, not a website to date.
    const url = (line.match(URL_RE) || []).find((u) => !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(u)) || null;
    const year = (line.match(YEAR_RE) || [])[1] || null;
    const yearAt = year ? line.indexOf(year) : -1;
    // Authors: what comes before the year, or before the first period.
    let authors = yearAt > 0 ? line.slice(0, yearAt) : line.split(/\.\s/)[0];
    authors = authors.replace(/[(\[,.\s]+$/, "").trim();
    // Title: in quotes, or the sentence after the year / authors.
    let title = (line.match(/[«"“]\s*([^»"”]{5,300})\s*[»"”]/) || [])[1] || null;
    if (!title) {
        const after = yearAt > 0 ? line.slice(yearAt + 4).replace(/^[)\].,:\s]+/, "") : line.slice(authors.length).replace(/^[.,:\s]+/, "");
        title = after.split(/\.\s|\.$|,\s(?:in|dans|éd\.|ed\.)\s/i)[0].trim() || null;
    }
    if (title && (title.length < 5 || /^https?:/.test(title))) title = null;
    const looksLikeAuthor = /[\p{Lu}][\p{L}'-]+/u.test(authors) && authors.length <= 160 && !/^https?:/.test(authors);
    const missing = [];
    if (!looksLikeAuthor) missing.push("auteur");
    if (!year) missing.push("année");
    if (!title) missing.push("titre");
    if (url && !/consult[ée]|accessed|retrieved/i.test(line)) missing.push("date de consultation du site");
    return { raw: line, authors: looksLikeAuthor ? authors : null, year, title, doi, url, missing };
}

function extractReferences(text) {
    const references = [];
    const heading = text.match(HEADING);
    let body = text;
    let bibliography = "";
    if (heading) {
        bibliography = text.slice(heading.index + heading[0].length);
        body = text.slice(0, heading.index);
        for (const line of bibliography.split(/\n+/)) if (words(line).length >= 3) references.push(parseEntry(line));
    }
    // Without a bibliography section: lines that look like references.
    if (!heading) {
        for (const line of text.split(/\n+/)) {
            const looks = (YEAR_RE.test(line) && /\(\s*(?:1[6-9]|20)\d{2}\s*\)|,\s*(?:1[6-9]|20)\d{2}\s*[.,]/.test(line) && words(line).length <= 60) || DOI_RE.test(line);
            DOI_RE.lastIndex = 0;
            if (looks && !IN_TEXT.test(line)) references.push(parseEntry(line));
            IN_TEXT.lastIndex = 0;
        }
    }
    // DOIs and links in the body, not already in an entry.
    const known = new Set(references.flatMap((r) => [r.doi, r.url]).filter(Boolean));
    for (const m of body.matchAll(DOI_RE)) if (!known.has(m[0])) references.push({ ...parseEntry(m[0]), raw: m[0], missing: ["auteur", "titre"] });
    for (const m of body.matchAll(URL_RE)) if (!known.has(m[0]) && !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(m[0])) references.push({ raw: m[0], url: m[0], authors: null, year: null, title: null, doi: null, missing: ["auteur", "titre", "date de consultation du site"] });
    return { references: references.slice(0, 80), body, bibliography };
}

function findCitations(text, body, references) {
    const citations = [...body.matchAll(IN_TEXT), ...body.matchAll(NARRATIVE)]
        .map((m) => ({ author: m[1].split(/\s/)[0], year: m[2], start: m.index, end: m.index + m[0].length }))
        // "En (2019)", "Selon (2019)": not an author.
        .filter((c) => !/^(?:Selon|Dans|En|Depuis|Avant|Après|Vers|Le|La|Les|Au|Of|In|Since)$/.test(c.author))
        .sort((a, b) => a.start - b.start);
    const issues = [];
    // A citation whose author isn't in the bibliography (or not that year).
    for (const c of citations) {
        const entries = references.filter((r) => r.raw.toLowerCase().includes(c.author.toLowerCase()));
        if (!entries.length) {
            issues.push({ type: "citation_absente", message: `Citation de ${c.author} (${c.year}) absente de la bibliographie.`, ...excerpt(text, c.start, c.end, 60) });
        } else if (!entries.some((r) => r.year === c.year)) {
            issues.push({ type: "reference_incoherente", message: `${c.author} est cité pour ${c.year}, mais la bibliographie donne ${entries.map((r) => r.year || "sans année").join(", ")}.`, ...excerpt(text, c.start, c.end, 60) });
        }
    }
    // Quotations with no reference nearby.
    const sents = sentences(body);
    for (const m of body.matchAll(QUOTE)) {
        const quote = m[1] || m[2] || m[3];
        if (words(quote).length < 8) continue;
        const end = m.index + m[0].length;
        // The reference must be in the same sentence, or right after the quote.
        const after = body.slice(end, end + 40);
        const sentence = sents.find((s) => s.start <= m.index && s.end >= m.index);
        const context = (sentence?.text || "") + " " + after;
        // "selon Ndong" names a source; "selon une étude" does not.
        const referenced = /\((?:[^()]*\b(?:1[6-9]|20)\d{2}|p\.?\s*\d+)[^()]*\)|\b(?:[Ss]elon|[Dd]'après) \p{Lu}|\[\d+\]|[Aa]ccording to \p{Lu}/u.test(context);
        if (!referenced) issues.push({ type: "citation_sans_reference", message: "Citation entre guillemets sans référence (auteur, année, page).", ...excerpt(text, m.index, end, 40) });
    }
    const cited = new Set(citations.map((c) => c.author.toLowerCase()));
    const uncited = citations.length ? references.filter((r) => r.authors && ![...cited].some((a) => r.authors.toLowerCase().includes(a))).length : 0;
    return { citations: citations.length, issues, uncited };
}

// --- External checks -------------------------------------------------------

const memoryCache = new Map();

// Firestore cache (eduCheckSourceCache), or memory in tests.
function makeCache(db) {
    if (!db) {
        return {
            get: async (k) => memoryCache.get(k) || null,
            set: async (k, v) => void memoryCache.set(k, v),
        };
    }
    const ref = (k) => db.collection("eduCheckSourceCache").doc(k);
    return {
        async get(k) {
            const snap = await ref(k).get().catch(() => null);
            const data = snap?.data?.();
            if (!data || Date.now() - data.at > CONFIG.sourceCacheDays * 86400000) return null;
            return data.result;
        },
        async set(k, result) {
            await ref(k).set({ result, at: Date.now() }).catch(() => {});
        },
    };
}

async function getJson(url, fetchImpl) {
    const res = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": "BomaVibes-EduCheck/1.0 (verification de references)" },
        signal: AbortSignal.timeout(CONFIG.sourceTimeoutMs),
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json() };
}

async function checkDoi(ref, fetchImpl) {
    const { notFound, data } = await getJson(`https://api.crossref.org/works/${encodeURIComponent(ref.doi)}`, fetchImpl);
    if (notFound) return { status: "introuvable", detail: "Ce DOI n’existe pas dans Crossref." };
    const work = data?.message || {};
    const found = (work.title || [])[0] || "";
    const year = String(work.issued?.["date-parts"]?.[0]?.[0] || "");
    if (ref.title && found && titleSimilarity(ref.title, found) < 0.4) {
        return { status: "incoherente", detail: `Le DOI existe, mais il correspond à un autre titre : « ${found} ».`, match: { title: found, year } };
    }
    return { status: "trouvee", detail: `Publication trouvée dans Crossref : « ${found} »${year ? ` (${year})` : ""}.`, match: { title: found, year } };
}

async function checkTitle(ref, fetchImpl) {
    const query = normalizeTitle(ref.title).slice(0, 14).join(" ");
    const { data } = await getJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5&select=display_name,publication_year,doi`, fetchImpl);
    const results = data?.results || [];
    let best = null;
    for (const r of results) {
        const sim = titleSimilarity(ref.title, r.display_name);
        if (!best || sim > best.sim) best = { sim, title: r.display_name, year: String(r.publication_year || ""), doi: r.doi };
    }
    if (best && best.sim >= 0.75) {
        const yearNote = ref.year && best.year && ref.year !== best.year ? ` L’année diffère (${ref.year} dans le devoir, ${best.year} dans OpenAlex).` : "";
        return { status: yearNote ? "incoherente" : "trouvee", detail: `Publication trouvée dans OpenAlex : « ${best.title} » (${best.year}).${yearNote}`, match: best };
    }
    if (best && best.sim >= 0.5) return { status: "a_verifier", detail: `Correspondance partielle dans OpenAlex : « ${best.title} » (${best.year}). À vérifier.`, match: best };
    return {
        status: "introuvable",
        detail: "Aucune publication correspondante dans OpenAlex. Elle peut exister hors de cette base (ouvrage local, rapport, cours) : vérification manuelle.",
    };
}

/**
 * @param {{ text: string, db?: object, fetchImpl?: Function, onProgress?: Function }} input
 */
async function analyzeSources({ text, db, fetchImpl = globalThis.fetch, onProgress, cache = makeCache(db) }) {
    const { references, body } = extractReferences(text);
    const { citations, issues, uncited } = findCitations(text, body, references);
    let lookups = 0;

    for (const ref of references) {
        ref.verification = null;
        if (ref.missing.length) issues.push({ type: "reference_incomplete", message: `Référence incomplète (manque : ${ref.missing.join(", ")}) : ${ref.raw.slice(0, 140)}` });
    }

    const checkable = references.filter((r) => r.doi || (r.title && normalizeTitle(r.title).length >= 3));
    for (const ref of references) {
        if (!ref.doi && !(ref.title && normalizeTitle(ref.title).length >= 3)) {
            ref.verification = { status: "a_verifier", detail: ref.url ? "Site web : à consulter manuellement (les liens ne sont jamais ouverts automatiquement)." : "Référence trop incomplète pour être recherchée automatiquement." };
        }
    }
    if (!CONFIG.sourceVerification) {
        for (const ref of checkable) ref.verification = { status: "a_verifier", detail: "Vérification externe désactivée sur ce serveur." };
    } else {
        for (const ref of checkable) {
            if (lookups >= CONFIG.maxSourceLookups) {
                ref.verification = { status: "a_verifier", detail: "Limite de vérifications automatiques atteinte : à vérifier manuellement." };
                continue;
            }
            const key = crypto.createHash("sha1").update(ref.doi ? `doi:${ref.doi.toLowerCase()}` : `t:${normalizeTitle(ref.title).join(" ")}|${ref.year || ""}`).digest("hex");
            const cached = await cache.get(key);
            if (cached) {
                ref.verification = { ...cached, cached: true };
                continue;
            }
            lookups++;
            try {
                ref.verification = ref.doi ? await checkDoi(ref, fetchImpl) : await checkTitle(ref, fetchImpl);
                await cache.set(key, ref.verification);
            } catch {
                ref.verification = { status: "indisponible", detail: "Service de vérification indisponible pour le moment : à vérifier manuellement." };
            }
            onProgress?.(lookups);
        }
    }

    const toVerify = references.filter((r) => ["introuvable", "a_verifier", "incoherente", "indisponible"].includes(r.verification?.status)).length;
    const counts = {};
    for (const r of references) counts[r.verification?.status || "a_verifier"] = (counts[r.verification?.status || "a_verifier"] || 0) + 1;
    return {
        status: "ok",
        references,
        citations,
        uncited,
        issues,
        counts,
        toVerify: toVerify + issues.filter((i) => ["citation_sans_reference", "citation_absente", "reference_incoherente"].includes(i.type)).length,
        summary: references.length
            ? `${references.length} référence${references.length > 1 ? "s" : ""} repérée${references.length > 1 ? "s" : ""}, ${citations} citation${citations > 1 ? "s" : ""} dans le texte.`
            : "Aucune référence bibliographique repérée.",
        limitations: [
            "Seules les bases Crossref et OpenAlex sont interrogées : une source absente n’est pas forcément fausse.",
            "Les liens web ne sont jamais ouverts automatiquement : à vérifier par l’enseignant.",
        ],
    };
}

// The homework without its bibliography (what the style analyses read).
function withoutBibliography(text) {
    const heading = text.match(HEADING);
    return heading ? text.slice(0, heading.index).trim() : text;
}

module.exports = { analyzeSources, extractReferences, parseEntry, titleSimilarity, withoutBibliography };
