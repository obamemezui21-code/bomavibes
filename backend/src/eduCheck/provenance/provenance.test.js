const test = require("node:test");
const assert = require("node:assert/strict");
const { findLocalEvidence } = require("./localEvidence");
const { analyzeProvenance } = require("./index");
const { checkWithIsGenAI } = require("./isgenai");

const ESSAY =
    "La liberté ne consiste pas à faire tout ce que l'on veut. Elle suppose des règles que l'on se donne à soi-même, et la vie avec les autres. Rousseau distingue la liberté naturelle et la liberté civile.";

test("a declaration of AI use is direct evidence, and names the tool", async () => {
    const r = await analyzeProvenance({ text: `${ESSAY}\n\nCe devoir a été rédigé avec l'aide de ChatGPT pour le plan.` });
    assert.equal(r.level, "elevee");
    assert.deepEqual(r.tools, ["ChatGPT"]);
    assert.equal(r.findings[0].kind, "declaration");
    assert.match(r.findings[0].passage.match, /rédigé avec l'aide de ChatGPT/);
});

test("ChatGPT's traces: utm_source links and citation marks", () => {
    const link = findLocalEvidence(`${ESSAY} Voir https://fr.wikipedia.org/wiki/Liberté?utm_source=chatgpt.com pour la définition.`);
    assert.equal(link.findings[0].kind, "trace");
    assert.deepEqual(link.tools, ["ChatGPT"]);
    const cite = findLocalEvidence(`${ESSAY} :contentReference[oaicite:2]{index=2}`);
    assert.equal(cite.findings[0].kind, "trace");
    const brackets = findLocalEvidence(`${ESSAY} 【4†source】`);
    assert.equal(brackets.findings[0].kind, "trace");
});

test("an assistant's words left in the homework: modérée", async () => {
    const r = await analyzeProvenance({ text: `Bien sûr ! Voici une dissertation sur la liberté :\n\n${ESSAY}\n\nN'hésitez pas à me demander une version plus longue.` });
    assert.equal(r.level, "moderee");
    assert.ok(r.findings.length >= 2);
    assert.ok(r.findings.every((f) => f.kind === "leftover"));
    // No tool named by the evidence: none claimed.
    assert.deepEqual(r.tools, []);
    const field = findLocalEvidence(`${ESSAY}\n\n[Votre nom]\n[Nom de l'établissement]`);
    assert.equal(field.findings.length, 2);
});

test("a homework ABOUT AI only names the tools: faible, never evidence", async () => {
    const text = "ChatGPT, Gemini et Claude transforment l'école. Beaucoup d'élèves utilisent ChatGPT pour réviser, et les professeurs s'interrogent. Mistral, une entreprise française, développe aussi des modèles.";
    const r = await analyzeProvenance({ text });
    assert.equal(r.level, "faible");
    assert.equal(r.findings.length, 0);
    assert.deepEqual(r.tools, []);
    assert.equal(r.mentions.find((m) => m.tool === "ChatGPT").count, 2);
    assert.ok(r.limitations.some((l) => /seulement nommés/.test(l)));
});

test("ordinary text: nothing found, and the limits say it proves nothing", async () => {
    const r = await analyzeProvenance({ text: `${ESSAY} Claude Lévi-Strauss a étudié les mythes. Je pense que la liberté s'apprend.` });
    assert.equal(r.level, "aucune");
    assert.equal(r.findings.length, 0);
    assert.ok(r.limitations[0].includes("ne montre pas"));
});

test("isGenAI is not called unless the teacher asked", async () => {
    let calls = 0;
    const r = await analyzeProvenance({ text: ESSAY }, { fetchImpl: async () => calls++ });
    assert.equal(calls, 0);
    assert.equal(r.engines.find((e) => e.key === "isgenai").status, "not_requested");
});

test("isGenAI: private request, its verdict read, the text cut at its limit", async () => {
    let sent;
    const fetchImpl = async (url, init) => {
        sent = { url, init, body: JSON.parse(init.body) };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                schema: "isgenai.check.v1",
                verdict: { code: "AI_INVOLVEMENT_VERIFIED", label: "AI involvement verified", summary: "The text declares AI use.", confidence: "high", caveats: [] },
                public_result: { headline: "AI DETECTED", basis: "Public label" },
                evidence: [{ class: "explicit_disclosure", outcome: "detected", strength: "strong", directness: "declarative", summary: "Declared use of ChatGPT", snippet: "rédigé avec ChatGPT", mechanism: "text_ai_clue_checker" }],
                disclosures: [{ snippet: "rédigé avec ChatGPT" }],
            }),
        };
    };
    const long = `${ESSAY} `.repeat(120);
    const r = await checkWithIsGenAI(long, { fetchImpl });
    assert.equal(sent.url, "https://isgenai.com/v1/check");
    assert.equal(sent.body.privacy, "private");
    assert.equal(sent.body.public_receipt, false);
    assert.equal(sent.body.text.length, 16000);
    assert.equal(r.status, "ok");
    assert.equal(r.aiFound, true);
    assert.equal(r.truncated, true);
    assert.equal(r.evidence[0].strength, "forte");
    assert.equal(r.label, "Utilisation d’une IA établie par une preuve");
});

test("isGenAI down or busy: the local search stands alone", async () => {
    const down = await analyzeProvenance({ text: `${ESSAY} Rédigé avec Claude.`, external: true }, { fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
    assert.equal(down.level, "elevee");
    assert.deepEqual(down.tools, ["Claude"]);
    assert.equal(down.engines.find((e) => e.key === "isgenai").status, "unavailable");
    assert.equal(down.isgenai, null);
    const busy = await checkWithIsGenAI(ESSAY, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ schema: "isgenai.error.v1", error: { code: "busy" } }) }) });
    assert.equal(busy.status, "unavailable");
    assert.match(busy.reason, /saturé/);
});

test("EDU_CHECK_ISGENAI=off: never called", async () => {
    process.env.EDU_CHECK_ISGENAI = "off";
    try {
        let calls = 0;
        const r = await analyzeProvenance({ text: ESSAY, external: true }, { fetchImpl: async () => calls++ });
        assert.equal(calls, 0);
        assert.equal(r.engines.find((e) => e.key === "isgenai").status, "off");
    } finally {
        delete process.env.EDU_CHECK_ISGENAI;
    }
});
