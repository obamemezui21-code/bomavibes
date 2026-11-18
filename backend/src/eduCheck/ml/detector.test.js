const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateWithModel, windowsOf, modelStatus } = require("./detector");
const { runAnalysis } = require("../engine");

const para = (n, seed) =>
    Array.from({ length: n }, (_, i) => `La phrase ${seed}-${i} décrit une idée précise du devoir et la relie à un exemple concret.`).join(" ");
// Six paragraphs of ~90 words: ~540 words of prose.
const ESSAY = Array.from({ length: 6 }, (_, i) => para(6, i)).join("\n\n");

test("off by default: says so, and never pretends to have measured", async () => {
    delete process.env.EDU_CHECK_ML_ENGINE;
    assert.equal(modelStatus().enabled, false);
    const r = await estimateWithModel({ text: ESSAY, lang: "fr" });
    assert.equal(r.status, "unavailable");
    assert.match(r.reason, /pas activé/);
    assert.equal(r.score, undefined);
});

test("windows follow paragraphs, 180–260 words, at most the maximum, spread out", () => {
    const w = windowsOf(ESSAY, 10);
    assert.ok(w.length >= 2);
    for (const x of w) assert.ok(x.text.split(/\s+/).length <= 300);
    const long = Array.from({ length: 30 }, (_, i) => para(6, i)).join("\n\n");
    const few = windowsOf(long, 4);
    assert.equal(few.length, 4);
    assert.equal(few[0].index, 0);
    assert.ok(few[3].index > few[2].index);
});

test("bands from the thresholds; passages under the moderate one are flagged", async () => {
    const scores = [0.7, 0.95, 0.85];
    const r = await estimateWithModel({ text: ESSAY, lang: "fr" }, { detector: async (texts) => texts.map((_, i) => ({ score: scores[i % 3], tokens: 200 })) });
    assert.equal(r.status, "ok");
    assert.equal(r.band, "moderee");
    assert.equal(r.score, 0.85);
    assert.deepEqual(
        r.passages.map((p) => p.band),
        r.passages.map((_, i) => ["elevee", "faible", "moderee"][i % 3]),
    );
    assert.match(r.observations[0], /aussi prévisible/);
    assert.ok(r.limitations.some((l) => /ne reconnaît pas le fournisseur/.test(l)));
    assert.ok(r.checkedAt);
});

test("too short, or not French: non concluant, the model is not run", async () => {
    let calls = 0;
    const detector = async (t) => (calls++, t.map(() => ({ score: 0.5, tokens: 10 })));
    assert.equal((await estimateWithModel({ text: para(3, 0), lang: "fr" }, { detector })).status, "inconclusive");
    assert.equal((await estimateWithModel({ text: ESSAY, lang: "en" }, { detector })).status, "inconclusive");
    assert.equal(calls, 0);
});

test("the engine failing: unavailable, the analysis goes on", async () => {
    const r = await estimateWithModel({ text: ESSAY, lang: "fr" }, { detector: async () => { throw new Error("boom"); } });
    assert.equal(r.status, "unavailable");
});

test("the AI check gives three separate results, never one score", async () => {
    const text = `${ESSAY}\n\nCe devoir a été rédigé avec l'aide de ChatGPT.`;
    const { result, steps } = await runAnalysis({ text, checks: ["ai"], meta: {} }, { detector: async (t) => t.map(() => ({ score: 0.99, tokens: 200 })) });
    assert.deepEqual(steps.map((s) => s.key), ["prepare", "provenance", "ml", "style", "ai"]);
    assert.equal(result.provenance.level, "elevee");
    assert.equal(result.ml.band, "faible");
    assert.ok(result.ai);
    assert.ok(!("aiTotal" in result) && !("combined" in result));
    assert.ok(result.attention.includes("preuve d’utilisation d’une IA dans le texte"));
});
