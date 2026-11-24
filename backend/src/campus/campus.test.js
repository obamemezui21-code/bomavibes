const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRoster, checkRoster, planImport, rosterHash, newStudentId, similarity } = require("./roster");
const { computeStats, listEvents, studentRecord, countMarks, weekStart } = require("./stats");
const { isDate, isTime, academicYear, today } = require("./config");

// Made-up names only: this repository is public.
const letters = "ABCDEFGHIJKLMNOPQRST";
const fakeName = (i) => `${letters[i % 20].repeat(3)}OU${letters[Math.floor(i / 20)].repeat(4)} ${letters[(i * 7) % 20]}ela${letters[(i * 3) % 20].toLowerCase()}ine${i}`.replace(/\d+/g, (d) => [...d].map((c) => "abcdefghij"[c]).join(""));
const fakeList = (n) => Array.from({ length: n }, (_, i) => `${i + 1}. ${fakeName(i)}`).join("\n");
const codes = (r, level) => r.anomalies.filter((a) => !level || a.level === level).map((a) => a.code);

test("reads numbered lists, keeping the spelling", () => {
    const e = parseRoster("1. MBA O NZE L'orée\n\n 2)  N’DONG   Élise \n3\tONDO-MBA Zoé\r\n4 - ESSONO Léa");
    assert.deepEqual(e.map((x) => [x.no, x.name]), [[1, "MBA O NZE L'orée"], [2, "N’DONG Élise"], [3, "ONDO-MBA Zoé"], [4, "ESSONO Léa"]]);
});

test("a complete list of 119 passes the checks", () => {
    const r = checkRoster(parseRoster(fakeList(119)), 119);
    assert.equal(r.count, 119);
    assert.equal(r.firstNo, 1);
    assert.equal(r.lastNo, 119);
    assert.deepEqual(codes(r, "error"), []);
    assert.equal(r.ok, true);
});

test("a short list, a missing or repeated number, an empty name are errors", () => {
    assert.deepEqual(codes(checkRoster(parseRoster(fakeList(118)), 119), "error"), ["missing_number", "count"]);
    const lines = fakeList(119).split("\n");
    lines[9] = lines[9].replace("10.", "11.");
    assert.deepEqual(codes(checkRoster(parseRoster(lines.join("\n")), 119), "error"), ["dup_number", "missing_number"]);
    const holes = fakeList(119).split("\n");
    holes[4] = "5.";
    assert.ok(codes(checkRoster(parseRoster(holes.join("\n")), 119), "error").includes("empty"));
    assert.ok(codes(checkRoster(parseRoster("Liste des étudiants\n1. ONDO Zoé"), 1), "error").includes("no_number"));
});

test("an exact duplicate is an error; a near one is only reported", () => {
    const dup = checkRoster(parseRoster("1. ONDO Zoé\n2. Ondo ZOE"), 2);
    assert.ok(codes(dup, "error").includes("duplicate"));
    const near = checkRoster(parseRoster("1. NDOMBO SIMBA Rita Anna\n2. NGOMBO SIMBA Rita Anna"), 2);
    assert.equal(near.ok, true);
    assert.deepEqual(codes(near), ["similar"]);
    assert.equal(near.count, 2);
    assert.equal(similarity("MBA NZE Rita", "Rita MBA NZE"), "mêmes mots, dans un autre ordre");
    assert.equal(similarity("ONDO Zoé", "MBOUMBA Carine"), null);
});

test("importing adds both look-alikes as two students", () => {
    const entries = parseRoster("1. NDOMBO SIMBA Rita Anna\n2. NGOMBO SIMBA Rita Anna");
    assert.equal(planImport(entries, []).added.length, 2);
});

test("a new list keeps known students, archives the others, merges nobody", () => {
    const existing = [
        { id: "A", name: "ONDO Zoe", active: true },
        { id: "B", name: "ESSONO Léa", active: true },
        { id: "C", name: "NDOMBO SIMBA Rita Anna", active: true },
    ];
    const plan = planImport(parseRoster("1. ONDO Zoé\n2. NGOMBO SIMBA Rita Anna\n3. MBA Paul"), existing);
    assert.deepEqual(plan.kept.map((k) => [k.id, k.renamed, k.name]), [["A", true, "ONDO Zoé"]]);
    assert.deepEqual(plan.added.map((a) => a.name), ["NGOMBO SIMBA Rita Anna", "MBA Paul"]);
    assert.deepEqual(plan.archived.map((a) => a.id), ["B", "C"]);
    assert.deepEqual(plan.toReconcile.map((t) => [t.no, t.oldId]), [[2, "C"]]);
});

test("two students of the same name in the old list are not guessed between", () => {
    const plan = planImport(parseRoster("1. ONDO Zoé"), [{ id: "A", name: "ONDO Zoé", active: true }, { id: "B", name: "ONDO ZOE", active: true }]);
    assert.equal(plan.kept.length, 0);
    assert.equal(plan.added.length, 1);
});

test("the confirmation is tied to the list shown", () => {
    const a = parseRoster("1. ONDO Zoé");
    assert.equal(rosterHash(a, "c", 0), rosterHash(parseRoster("1. ONDO Zoé"), "c", 0));
    assert.notEqual(rosterHash(a, "c", 0), rosterHash(parseRoster("1. ONDO Zoe"), "c", 0));
    assert.notEqual(rosterHash(a, "c", 0), rosterHash(a, "c", 1));
});

test("identifiers are unique and carry nothing of the list", () => {
    const ids = new Set(Array.from({ length: 5000 }, newStudentId));
    assert.equal(ids.size, 5000);
    for (const id of ids) assert.match(id, /^ETU-[0-9A-HJKMNP-TV-Z]{8}$/);
});

const roster = [{ id: "a", name: "A", no: 1 }, { id: "b", name: "B", no: 2 }, { id: "c", name: "C", no: 3 }, { id: "d", name: "D", no: 4 }];
const session = (id, date, marks, extra = {}) => ({ id, date, start: "08:00", end: "10:00", subjectId: "m1", subjectName: "Droit", teacherId: "t1", teacherName: "T", status: "validated", roster, marks: Object.fromEntries(Object.entries(marks).map(([k, s]) => [k, { s }])), ...extra });

test("an empty mark is neither present nor absent", () => {
    assert.deepEqual(countMarks(roster, { a: { s: "P" }, b: { s: null, n: "?" } }), { p: 1, r: 0, a: 0, n: 3 });
    const s = computeStats([session("1", "2026-11-23", { a: "P", b: "R", c: "A" })], roster);
    assert.deepEqual([s.totals.p, s.totals.r, s.totals.a, s.totals.n, s.totals.rated], [1, 1, 1, 1, 3]);
    assert.equal(s.totals.presenceRate, 2 / 3);
    assert.equal(s.totals.absenceRate, 1 / 3);
    const d = s.students.find((x) => x.id === "d");
    assert.deepEqual([d.sessions, d.n, d.presenceRate], [1, 1, null]);
});

test("only validated sessions count, with filters by period, subject, teacher", () => {
    const all = [
        session("1", "2026-10-05", { a: "A" }),
        session("2", "2026-11-23", { a: "P" }, { subjectId: "m2", subjectName: "Anatomie" }),
        session("3", "2026-11-24", { a: "A" }, { status: "draft" }),
        session("4", "2026-11-24", { a: "A" }, { status: "cancelled" }),
        session("5", "2026-11-25", { a: "R" }, { teacherId: "t2" }),
    ];
    assert.equal(computeStats(all, roster).sessions, 3);
    assert.equal(computeStats(all, roster, { from: "2026-11-01" }).sessions, 2);
    assert.equal(computeStats(all, roster, { subjectId: "m2" }).sessions, 1);
    assert.equal(computeStats(all, roster, { teacherId: "t2" }).totals.r, 1);
    const s = computeStats(all, roster);
    assert.deepEqual(s.subjects.map((x) => [x.name, x.sessions]), [["Anatomie", 1], ["Droit", 2]]);
    assert.deepEqual(s.months.map((x) => x.month), ["2026-10", "2026-11"]);
    assert.deepEqual(s.weeks.map((x) => [x.week, x.a]), [["2026-10-05", 1], ["2026-11-23", 0]]);
});

test("the sheets of a student who left the list still count for them", () => {
    const s = computeStats([session("1", "2026-11-23", { a: "A" })], [roster[1]]);
    assert.equal(s.students.find((x) => x.id === "a").a, 1);
    assert.equal(s.students.find((x) => x.id === "a").active, false);
});

test("absences and lates, in order", () => {
    const all = [session("2", "2026-11-25", { a: "R", b: "P" }), session("1", "2026-11-23", { a: "A" }), session("3", "2026-11-26", { c: "A" }, { status: "draft" })];
    assert.deepEqual(listEvents(all, roster).map((e) => [e.date, e.id, e.status]), [["2026-11-23", "a", "A"], ["2026-11-25", "a", "R"]]);
});

test("a student's record", () => {
    const r = studentRecord([session("1", "2026-11-23", { a: "A" }), session("2", "2026-11-25", { a: "R" }), session("3", "2026-11-26", {})], "a");
    assert.deepEqual([r.sessions, r.p, r.r, r.a, r.n], [3, 0, 1, 1, 1]);
    assert.equal(r.presenceRate, 0.5);
    assert.deepEqual(r.history.map((h) => [h.date, h.status]), [["2026-11-26", null], ["2026-11-25", "R"], ["2026-11-23", "A"]]);
});

test("dates", () => {
    assert.equal(weekStart("2026-11-29"), "2026-11-23");
    assert.equal(weekStart("2026-11-23"), "2026-11-23");
    assert.equal(isDate("2026-02-30"), false);
    assert.equal(isDate("2026-02-28"), true);
    assert.equal(isTime("24:00"), false);
    assert.equal(isTime("07:30"), true);
    assert.equal(academicYear("2026-11-24"), "2026-2027");
    assert.equal(academicYear("2027-07-01"), "2026-2027");
    assert.equal(today(new Date("2026-11-24T23:30:00Z")), "2026-11-25");
});
