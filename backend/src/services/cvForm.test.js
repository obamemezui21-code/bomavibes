const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cleanForm, cleanCv, hasContent, view, PER_MEMBER_PER_DAY } = require("./cvForm");

test("cleanForm keeps known fields, trims, caps lengths and list sizes", () => {
    const form = cleanForm({
        identite: { nom: "  Awa  ", email: "a@b.ga", extra: "dropped" },
        posteRecherche: "x".repeat(1000),
        experiences: Array.from({ length: 40 }, (_, i) => ({ entreprise: `E${i}`, description: 5 })),
        langues: [{ langue: "fang", niveau: "maternel" }, { langue: "", niveau: "bon" }],
        hacker: "<script>",
    });
    assert.equal(form.identite.nom, "Awa");
    assert.ok(!("extra" in form.identite));
    assert.ok(!("hacker" in form));
    assert.equal(form.posteRecherche.length, 300);
    assert.equal(form.experiences.length, 15);
    assert.equal(form.experiences[0].description, "");
    assert.deepEqual(form.langues, [{ langue: "fang", niveau: "maternel" }]);
});

test("cleanForm survives garbage", () => {
    for (const bad of [null, undefined, "x", 3, [], { experiences: "nope", identite: "nope" }]) {
        const form = cleanForm(bad);
        assert.deepEqual(form.experiences, []);
        assert.equal(form.identite.nom, "");
    }
});

test("empty rows are dropped", () => {
    const form = cleanForm({ experiences: [{ debut: "2020" }], formations: [{ annee: "2019" }] });
    assert.deepEqual(form.experiences, []);
    assert.deepEqual(form.formations, []);
    assert.equal(hasContent(form), false);
    assert.equal(hasContent(cleanForm({ competences: "Excel" })), true);
});

test("cleanCv keeps the CV's shape and drops the rest", () => {
    const cv = cleanCv({
        titrePoste: " Comptable ",
        experiences: [{ entreprise: "BGFI", taches: ["Saisir les écritures", "", 7] }, {}],
        langues: [{ langue: "Anglais", niveau: "moyen" }],
        conseils: ["a", "b", "c", "d", "e", "f"],
        injected: true,
    });
    assert.equal(cv.titrePoste, "Comptable");
    assert.equal(cv.experiences.length, 1);
    assert.deepEqual(cv.experiences[0].taches, ["Saisir les écritures"]);
    assert.equal(cv.conseils.length, 5);
    assert.ok(!("injected" in cv));
    assert.equal(cleanCv(null), null);
});

test("view counts today's CVs only and flags a write that died", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    assert.equal(view({ day: "2026-11-15", count: 1 }, now).remainingToday, PER_MEMBER_PER_DAY - 1);
    assert.equal(view({ day: "2026-11-14", count: 3 }, now).remainingToday, PER_MEMBER_PER_DAY);
    assert.equal(view(undefined, now).status, "idle");
    const fresh = view({ status: "pending", startedAt: new Date(now - 30 * 1000) }, now);
    assert.equal(fresh.status, "pending");
    const stale = view({ status: "pending", startedAt: new Date(now - 10 * 60 * 1000) }, now);
    assert.equal(stale.status, "error");
});
