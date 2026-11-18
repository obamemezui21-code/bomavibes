const test = require("node:test");
const assert = require("node:assert");
const { runAnalysis } = require("./engine");
const { analyzeAiWriting } = require("./analysis/aiWriting");
const { analyzeSources, parseEntry } = require("./sources/sourceVerification");
const { compareTexts } = require("./analysis/styleComparison");
const { parseDocument } = require("./documentParser");
const T = require("./__fixtures__/texts");

// These tests check how EDU-CHECK BEHAVES on typical texts. They do not
// validate any detection: a few texts prove nothing statistically, and the
// AI index is a heuristic, never a probability.

const ALL = ["ai", "quality", "sources", "coherence", "level"];
const TOPIC = "Le téléphone portable à l'école : faut-il l'interdire ?";

// No network in tests: Crossref says "not found", OpenAlex finds nothing.
function fakeFetch(calls = []) {
    return async (url) => {
        calls.push(url);
        if (url.includes("crossref")) return { status: 404, ok: false, json: async () => ({}) };
        return { status: 200, ok: true, json: async () => ({ results: [] }) };
    };
}

const analyse = (text, level = "premiere_annee", extra = {}) =>
    runAnalysis({ text, checks: ALL, meta: { level, topic: TOPIC }, ...extra }, { fetchImpl: fakeFetch() }).then((r) => r.result);

test("a student's own writing gets a low index", async () => {
    const r = await analyse(T.natural);
    assert.strictEqual(r.ai.status, "ok");
    assert.ok(r.ai.score <= 20, `got ${r.ai.score}`);
});

test("a typical generated text gets a clearly higher index, with the reasons shown", async () => {
    const [gen, nat] = await Promise.all([analyse(T.generated), analyse(T.natural)]);
    assert.ok(gen.ai.score > 60, `got ${gen.ai.score}`);
    assert.ok(gen.ai.score - nat.ai.score >= 40);
    const generic = gen.ai.signals.find((s) => s.key === "generic_phrases");
    assert.ok(generic.passages.length > 0, "the generic phrases are quoted");
    assert.ok(gen.ai.observations.length >= 2);
});

test("a human text smoothed by a corrector is not treated as generated", async () => {
    const r = await analyse(T.corrected);
    assert.ok(r.ai.score <= 40, `got ${r.ai.score}`);
    assert.ok(r.quality.score >= 80, "and its good form is credited to quality, not to AI");
});

test("a heavily reworded text: the index drops (a known limit, said in the limitations)", async () => {
    const r = await analyse(T.reworded);
    assert.ok(r.ai.score <= 40, `got ${r.ai.score}`);
});

test("a very short text: non concluant, no artificial score", async () => {
    const r = await analyse(T.short);
    assert.strictEqual(r.ai.status, "inconclusive");
    assert.strictEqual(r.ai.score, undefined);
    assert.match(r.ai.reason, /trop court/);
});

test("a structured academic text is not pushed up for its structure", async () => {
    const r = await analyse(T.academic, "master");
    assert.ok(r.ai.score <= 40, `got ${r.ai.score}`);
    const transitions = r.ai.signals.find((s) => s.key === "transition_regularity");
    if (transitions) assert.ok(transitions.weight < 0.8, "transitions count for less at master level");
    assert.strictEqual(r.sources.issues.length, 0, "its correct references raise no issue");
});

test("a text full of errors gets a low quality score, with the errors listed", async () => {
    const [bad, good] = await Promise.all([analyse(T.withErrors), analyse(T.natural)]);
    assert.ok(bad.quality.score < 60, `got ${bad.quality.score}`);
    assert.ok(good.quality.score - bad.quality.score >= 30);
    const messages = bad.quality.issues.map((i) => i.message).join(" ");
    assert.match(messages, /malgré/);
    assert.match(messages, /parmi/);
    assert.match(messages, /quel que soit/);
});

test("correct spellings are never flagged as mistakes", () => {
    const { analyzeWritingQuality } = require("./analysis/writingQuality");
    const text =
        "Le développement des compétences numériques est un objectif. Nous voulons développer ces outils, et les élèves développent leur autonomie. Malgré les difficultés, quel que soit le niveau, parmi les élèves, chacun progresse. Aujourd'hui, le raisonnement compte plus que la mémoire.";
    const r = analyzeWritingQuality({ text, lang: "fr" });
    const spelling = r.issues.filter((i) => i.type === "orthographe_grammaire");
    assert.deepStrictEqual(spelling.map((i) => i.match), []);
});

test("misspellings of « développer » are flagged", () => {
    const { analyzeWritingQuality } = require("./analysis/writingQuality");
    const r = analyzeWritingQuality({
        text: "Il faut dévelloper les outils numériques dans les écoles. Le dévelopement des élèves en dépend, dans toutes les classes du pays, chaque année, sans exception, car les enseignants le demandent depuis longtemps.",
        lang: "fr",
    });
    assert.strictEqual(r.issues.filter((i) => /développer/.test(i.message)).length, 2);
});

test("fake references are flagged, nothing is made up, student links are never opened", async () => {
    const calls = [];
    const r = await analyzeSources({ text: T.fakeReferences, fetchImpl: fakeFetch(calls) });
    const types = r.issues.map((i) => i.type);
    assert.ok(types.includes("citation_absente"), "Kouassi (2018) is not in the bibliography");
    assert.ok(types.includes("reference_incoherente"), "Bernard 2022 vs 2021");
    assert.ok(types.includes("citation_sans_reference"), "the quotation has no reference");
    assert.ok(types.includes("reference_incomplete"));
    const doi = r.references.find((x) => x.doi);
    assert.strictEqual(doi.verification.status, "introuvable");
    assert.ok(!calls.some((u) => u.includes("exemple-blog")), "the student's link was never fetched");
    for (const ref of r.references) assert.ok(!ref.verification?.match || ref.verification.match.title, "no invented match");
});

test("a reference found in OpenAlex is marked found, with what was found", async () => {
    const fetchImpl = async () => ({ status: 200, ok: true, json: async () => ({ results: [{ display_name: "Attention et objets connectés en classe", publication_year: 2019 }] }) });
    // Its own empty cache: earlier tests cached these titles as "not found".
    const r = await analyzeSources({ text: T.academic, fetchImpl, cache: { get: async () => null, set: async () => {} } });
    const dupont = r.references.find((x) => x.authors?.startsWith("Dupont"));
    assert.strictEqual(dupont.verification.status, "trouvee");
});

test("one isolated indicator never pushes the index past 40", () => {
    // Sentences of the same length, nothing else.
    const text = Array.from({ length: 14 }, (_, i) => `Le cours numéro ${i + 1} présente une notion différente aux élèves de la classe.`).join(" ");
    const r = analyzeAiWriting({ text: text + " " + text, lang: "fr" });
    if (r.status === "ok") assert.ok(r.score <= 40 || r.signals.filter((s) => s.value >= 50).length >= 2);
});

test("an unknown language is non concluant", () => {
    const r = analyzeAiWriting({ text: "Lorem ipsum dolor sit amet. ".repeat(60), lang: null });
    assert.strictEqual(r.status, "inconclusive");
});

test("a bibliography line is split into author, year and title", () => {
    const e = parseEntry("Dupont, J. (2019). Attention et objets connectés en classe. Revue française de pédagogie, 12(3), 45-60.");
    assert.strictEqual(e.year, "2019");
    assert.match(e.authors, /Dupont/);
    assert.match(e.title, /Attention et objets connectés/);
    assert.deepStrictEqual(e.missing, []);
});

test("comparison mode: the style of two texts side by side", () => {
    const r = compareTexts({ texts: [{ label: "Devoir 1", text: T.natural }, { label: "Devoir 2", text: T.generated }] });
    assert.strictEqual(r.pairs.length, 1);
    assert.ok(r.pairs[0].similarity < 90);
    assert.ok(r.features.every((f) => f.values.length === 2));
});

test("style against earlier works feeds the AI index, without deciding it alone", async () => {
    const r = await analyse(T.generated, "premiere_annee", { priorTexts: [T.natural, T.reworded] });
    assert.strictEqual(r.style.status, "ok");
    assert.ok(r.style.similarity < 75);
    assert.ok(r.ai.signals.some((s) => s.key === "style_shift"));
});

test("the disclaimer is always part of the result", async () => {
    const r = await analyse(T.natural);
    assert.match(r.disclaimer, /ne permettent pas d’établir avec certitude/);
    assert.ok(r.recommendations.some((x) => /Aucune sanction/.test(x)));
});

// --- Documents ---------------------------------------------------------------

// A minimal but valid PDF with one line of text, built by hand.
function makePdf(line) {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        null,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    const stream = `BT /F1 12 Tf 72 760 Td (${line}) Tj ET`;
    objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach((body, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, "latin1");
}

async function makeDocx(paragraphs) {
    const JSZip = require("jszip");
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("");
    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
    return zip.generateAsync({ type: "nodebuffer" });
}

test("reads the text of a PDF", async () => {
    const r = await parseDocument({ buffer: makePdf("Le telephone portable a l'ecole est un vrai sujet de debat."), originalname: "devoir.pdf" });
    assert.strictEqual(r.kind, "pdf");
    assert.match(r.text, /telephone portable/);
    assert.ok(r.words >= 10);
});

test("reads the text of a DOCX", async () => {
    const buffer = await makeDocx(["Le téléphone à l’école.", "Deuxième paragraphe du devoir."]);
    const r = await parseDocument({ buffer, originalname: "devoir.docx" });
    assert.strictEqual(r.kind, "docx");
    assert.match(r.text, /Deuxième paragraphe/);
});

test("refuses a file whose content doesn't match its name", async () => {
    await assert.rejects(parseDocument({ buffer: Buffer.from("pas un pdf"), originalname: "devoir.pdf" }), /pas un vrai PDF/);
    await assert.rejects(parseDocument({ buffer: Buffer.from("MZ\x90\x00binaire"), originalname: "devoir.exe" }), /Format non pris en charge/);
    await assert.rejects(parseDocument({ buffer: Buffer.from("abc\x00def"), originalname: "devoir.txt" }), /binaires/);
});

test("reads a TXT, in UTF-8 or Windows-1252", async () => {
    const utf8 = await parseDocument({ buffer: Buffer.from("Un élève a écrit ce devoir.", "utf8"), originalname: "a.txt" });
    assert.match(utf8.text, /élève/);
    const latin = await parseDocument({ buffer: Buffer.from("Un \xe9l\xe8ve a \xe9crit ce devoir \xe0 la maison, \xe9videmment, avec \xe9l\xe9gance et \xe9nergie.", "latin1"), originalname: "b.txt" });
    assert.match(latin.text, /élève/);
});
