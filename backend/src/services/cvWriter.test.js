const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// The real SDK against a local stand-in for the API: checks what is sent to
// Claude and how the answer is read, without calling (or paying for) it.
let server;
let lastRequest = null;
let nextReply = null;

before(async () => {
    server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            lastRequest = { url: req.url, headers: req.headers, body: JSON.parse(body) };
            const { status = 200, json, headers = {} } = nextReply;
            res.writeHead(status, { "content-type": "application/json", ...headers });
            res.end(JSON.stringify(json));
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const { writeCv, inPnpeOrder, dateValue, candidateMessage, CvWriterError } = require("./cvWriter");

const FORM = {
    identite: { nom: "Awa NDONG", telephones: "+241 77 12 34 56", email: "awa@example.ga", numeroPnpe: "D18401-2023-G1", permis: "Permis B", ville: "Libreville", quartier: "Akébé" },
    posteRecherche: "operatrice production petrole",
    offre: "Perenco recrute un opérateur de production",
    experiences: [
        { debut: "01/2019", fin: "12/2020", enCours: false, entreprise: "Total", ville: "Port-Gentil", poste: "stagiaire", description: "je surveillais les pompes" },
        { debut: "03/2021", fin: "", enCours: true, entreprise: "Perenco", ville: "Port-Gentil", poste: "technicienne", description: "controle des vannes, rapports" },
    ],
    formations: [{ annee: "2018", intitule: "BTS maintenance", etablissement: "IST" }],
    competences: "excel, word",
    langues: [{ langue: "français", niveau: "maternel" }],
    texteLibre: "",
};

const MODEL_CV = {
    titrePoste: "Opératrice de production (pétrole)",
    experiences: [
        { debut: "Janvier 2019", fin: "Décembre 2020", entreprise: "Total", lieu: "Port-Gentil", poste: "Stagiaire", taches: ["Surveiller les pompes"] },
        { debut: "Mars 2021", fin: "Aujourd'hui", entreprise: "Perenco", lieu: "Port-Gentil", poste: "Technicienne", taches: ["Contrôler les vannes", "Rédiger les rapports"] },
    ],
    formations: [{ annee: "2018", intitule: "BTS Maintenance industrielle", etablissement: "IST" }],
    certifications: [],
    competencesTechniques: ["Pack Office"],
    savoirFaire: ["Rédaction de rapports"],
    langues: [{ langue: "Français", niveau: "maternel" }],
    conseils: [],
};

function reply(stopReason, text, extra = {}) {
    return {
        json: {
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-opus-5-5",
            content: text === null ? [] : [{ type: "text", text }],
            stop_reason: stopReason,
            stop_sequence: null,
            usage: { input_tokens: 1200, output_tokens: 900 },
            ...extra,
        },
    };
}

test("sends the PNPE request: model, fallbacks, structured output, effort", async () => {
    nextReply = reply("end_turn", JSON.stringify(MODEL_CV));
    await writeCv(FORM);
    const { body, headers, url } = lastRequest;
    assert.match(url, /^\/v1\/messages/);
    assert.equal(body.model, "claude-opus-5-5");
    assert.equal(body.fallbacks, "default");
    assert.match(headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
    assert.match(headers["anthropic-beta"], /structured-outputs/);
    assert.equal(body.output_config.effort, "medium");
    assert.equal(body.output_config.format.type, "json_schema");
    assert.ok(body.output_config.format.schema.properties.titrePoste);
    assert.ok(!("thinking" in body), "thinking left to the model's default (adaptive)");
    assert.ok(!("temperature" in body));
});

test("never sends the member's identity to the AI", async () => {
    nextReply = reply("end_turn", JSON.stringify(MODEL_CV));
    await writeCv(FORM);
    const sent = JSON.stringify(lastRequest.body);
    for (const secret of ["Awa NDONG", "77 12 34 56", "awa@example.ga", "D18401-2023-G1", "Akébé", "Permis B"]) {
        assert.ok(!sent.includes(secret), `identity leaked: ${secret}`);
    }
    // …but the career and the offer do go.
    assert.ok(sent.includes("controle des vannes"));
    assert.ok(sent.includes("Perenco recrute"));
});

test("returns the CV newest first, whatever the model's order", async () => {
    nextReply = reply("end_turn", JSON.stringify(MODEL_CV));
    const cv = await writeCv(FORM);
    assert.deepEqual(cv.experiences.map((e) => e.entreprise), ["Perenco", "Total"]);
    assert.equal(cv.titrePoste, "Opératrice de production (pétrole)");
});

test("a refusal becomes a clear message, not a crash", async () => {
    nextReply = reply("refusal", null, { stop_details: { type: "refusal", category: null, explanation: null } });
    await assert.rejects(writeCv(FORM), (err) => err instanceof CvWriterError && /n'a pas pu rédiger/.test(err.message));
});

test("an answer cut short (max_tokens) is reported as failed", async () => {
    nextReply = reply("max_tokens", '{"titrePoste": "Opér');
    await assert.rejects(writeCv(FORM), (err) => err instanceof CvWriterError && err.retryable);
});

test("an overloaded API is reported as retryable", async () => {
    nextReply = { status: 529, headers: { "retry-after-ms": "1" }, json: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } };
    await assert.rejects(writeCv(FORM), (err) => err instanceof CvWriterError && err.retryable && /sollicité/.test(err.message));
});

test("an answer that doesn't match the schema is rejected", async () => {
    nextReply = reply("end_turn", JSON.stringify({ titrePoste: 42 }));
    await assert.rejects(writeCv(FORM), (err) => err instanceof CvWriterError);
});

test("dateValue reads French dates", () => {
    assert.equal(dateValue("Aujourd'hui"), Infinity);
    assert.equal(dateValue("en cours"), Infinity);
    assert.ok(dateValue("Décembre 2020") > dateValue("Janvier 2020"));
    assert.ok(dateValue("Janvier 2021") > dateValue("Décembre 2020"));
    assert.equal(dateValue("2019 – 2021"), 2021);
    assert.equal(dateValue(""), null);
    assert.equal(dateValue("je ne sais plus"), null);
});

test("inPnpeOrder keeps the model's order when a date is unreadable", () => {
    const cv = { ...MODEL_CV, experiences: [{ ...MODEL_CV.experiences[0], debut: "", fin: "" }, MODEL_CV.experiences[1]] };
    assert.deepEqual(inPnpeOrder(cv).experiences.map((e) => e.entreprise), ["Total", "Perenco"]);
});

test("inPnpeOrder puts the most recent diplomas first", () => {
    const cv = { ...MODEL_CV, formations: [{ annee: "2015", intitule: "Bac", etablissement: "" }, { annee: "2018", intitule: "BTS", etablissement: "" }] };
    assert.deepEqual(inPnpeOrder(cv).formations.map((f) => f.intitule), ["BTS", "Bac"]);
});

test("candidateMessage leaves the identity out", () => {
    const text = candidateMessage(FORM);
    assert.ok(!text.includes("identite"));
    assert.ok(text.includes("<offre_emploi>"));
});
