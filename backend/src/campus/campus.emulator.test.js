// The whole Campus API against the Firestore emulator. Skipped unless it runs:
//   java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host 127.0.0.1 --port 8085
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --test src/campus/campus.emulator.test.js
// The app's own Firebase credentials are never loaded here.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const on = !!process.env.FIRESTORE_EMULATOR_HOST;
const it = (name, fn) => test(name, { skip: on ? false : "Firestore emulator not running" }, fn);

let base;
let server;
let db;
let C;
const scansDir = fs.mkdtempSync(path.join(os.tmpdir(), "campus-scans-"));
const ACCOUNTS = { "agent2@inass.test": { uid: "agent2", emailVerified: true }, "faux@inass.test": { uid: "faux", emailVerified: false }, "prof@inass.test": { uid: "prof", emailVerified: true } };

if (on) {
    process.env.CAMPUS_SCANS_DIR = scansDir;
    const firebase = require("firebase-admin");
    firebase.initializeApp({ projectId: `demo-campus-${process.pid}` });
    const stub = {
        firestore: firebase.firestore,
        auth: () => ({
            getUserByEmail: async (email) => {
                if (ACCOUNTS[email]) return ACCOUNTS[email];
                throw Object.assign(new Error("no"), { code: "auth/user-not-found" });
            },
        }),
    };
    const put = (rel, exports) => {
        const file = require.resolve(rel);
        require.cache[file] = { id: file, filename: file, loaded: true, exports };
    };
    put("../config/firebaseAdmin", stub);
    put("../middleware/firebaseAuthMiddleware", (req, res, next) => {
        const uid = req.headers["x-user"];
        if (!uid) return res.status(401).json({ message: "Authentification requise" });
        req.firebaseUser = { uid, email: `${uid}@inass.test` };
        next();
    });
    db = firebase.firestore();
}

test.before(async () => {
    if (!on) return;
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/api/campus", require("./routes"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}/api/campus`;
    await db.collection("users").doc("boss").set({ role: "admin", firstName: "Direction" });
    await db.collection("users").doc("someone").set({ role: "user" });
    await db.collection("users").doc("modo").set({ role: "moderator" });
    await db.collection("campusMembers").doc("agent").set({ org: "INASS", role: "agent", name: "Agent Un", canExport: true });
    await db.collection("campusMembers").doc("other").set({ org: "AUTRE", role: "admin", name: "Ailleurs" });
    await db.collection("campusMembers").doc("localadmin").set({ org: "INASS", role: "admin", name: "Admin INASS" });
});
test.after(() => {
    server?.closeAllConnections?.();
    server?.close();
    fs.rmSync(scansDir, { recursive: true, force: true });
});

async function call(user, method, url, body) {
    const res = await fetch(base + url, { method, headers: { ...(user ? { "x-user": user } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
}
async function ok(...args) {
    const r = await call(...args);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
}

const AB = "ABCDEFGHIJKLMNOPQRST";
const fake = (i) => `${AB[i % 20]}${AB[(i * 7 + 3) % 20]}OUMBA ${AB[Math.floor(i / 20)]}${AB[(i * 11) % 20]}${AB[(i * 13 + 5) % 20]}ENGUE ${AB[(i * 3) % 20]}ela${AB[(i * 17) % 20].toLowerCase()}${AB[Math.floor(i / 6) % 20].toLowerCase()}`;
const names = Array.from({ length: 119 }, (_, i) => fake(i));
names[85] = "NDOMBO SIMBA Rita Anna";
names[88] = "NGOMBO SIMBA Rita Anna";
const list = (arr) => arr.map((n, i) => `${i + 1}. ${n}`).join("\n");

it("only campus accounts get in", async () => {
    assert.equal((await call(null, "GET", "/me")).status, 401);
    assert.deepEqual(await ok("someone", "GET", "/me"), { allowed: false });
    assert.equal((await call("someone", "GET", "/bootstrap")).status, 403);
    assert.equal((await call("modo", "GET", "/bootstrap")).status, 403);
    assert.equal((await ok("boss", "GET", "/bootstrap")).me.role, "admin");
    assert.equal((await ok("agent", "GET", "/bootstrap")).me.role, "agent");
});

it("creates the class and imports 119 students, after a report, with no status", async () => {
    assert.equal((await call("agent", "POST", "/classes", { code: "L1", label: "Licence 1", expected: 119 })).status, 403);
    C = (await ok("boss", "POST", "/classes", { code: "L1", label: "Licence 1", expected: 119 })).id;
    assert.equal((await call("boss", "POST", "/classes", { code: "l1", label: "x", expected: 1 })).status, 409);

    // First the former list of 118.
    const old = names.slice(0, 118);
    old[3] = "ANCIEN ETUDIANT Parti";
    const p118 = await ok("boss", "POST", `/classes/${C}/import/preview`, { text: list(old), expected: 118 });
    assert.equal(p118.report.ok, true, JSON.stringify(p118.report.anomalies));
    assert.equal((await db.collection("campusStudents").get()).size, 0, "the report writes nothing");
    assert.equal((await call("boss", "POST", `/classes/${C}/import`, { text: list(old), expected: 118, hash: p118.hash })).status, 400, "needs a confirmation");
    assert.equal((await call("boss", "POST", `/classes/${C}/import`, { text: list(old), expected: 118, hash: "x".repeat(64), confirmed: true })).status, 409);
    assert.equal((await call("agent", "POST", `/classes/${C}/import`, { text: list(old), expected: 118, hash: p118.hash, confirmed: true })).status, 403);
    await ok("boss", "POST", `/classes/${C}/import`, { text: list(old), expected: 118, hash: p118.hash, confirmed: true });
});

let sessionId;
let subject;
let teacher;
let students;

it("a sheet of the former list keeps its history when the 119 replace it", async () => {
    subject = (await ok("agent", "POST", "/subjects", { name: "Droit social" })).id;
    assert.equal((await ok("agent", "POST", "/subjects", { name: "DROIT  SOCIAL" })).id, subject, "the same subject once");
    teacher = (await ok("agent", "POST", "/teachers", { name: "M. Enseignant" })).id;
    const before = (await ok("agent", "GET", `/classes/${C}/students`)).students;
    const s = (await ok("agent", "POST", "/sessions", { classId: C, date: "2026-11-02", start: "08:00", end: "10:00", subjectId: subject, teacherId: teacher })).id;
    const gone = before.find((x) => x.name === "ANCIEN ETUDIANT Parti");
    await ok("agent", "PATCH", `/sessions/${s}/marks`, { changes: [{ id: gone.id, s: "A", n: "malade" }] });
    await ok("agent", "POST", `/sessions/${s}/validate`, { confirmed: true, allowUnfilled: true });

    const preview = await ok("boss", "POST", `/classes/${C}/import/preview`, { text: list(names), expected: 119 });
    assert.equal(preview.report.count, 119);
    assert.equal(preview.plan.kept.length, 117);
    assert.equal(preview.plan.added.length, 2);
    assert.deepEqual(preview.plan.archived.map((x) => x.name), ["ANCIEN ETUDIANT Parti"]);
    assert.ok(preview.report.anomalies.some((a) => a.code === "similar" && /86/.test(a.message) && /89/.test(a.message)));
    const done = await ok("boss", "POST", `/classes/${C}/import`, { text: list(names), expected: 119, hash: preview.hash, confirmed: true });
    assert.deepEqual([done.active, done.uniqueIds, done.numbersOk], [119, 119, true]);

    students = (await ok("agent", "GET", `/classes/${C}/students`)).students.filter((x) => x.active);
    assert.equal(students.length, 119);
    assert.deepEqual(students.map((x) => x.name), names, "spelling and order exactly as given");
    assert.notEqual(students[85].id, students[88].id, "look-alikes stay two students");
    for (const st of students.slice(0, 3)) assert.equal(st.id, before.find((b) => b.name === st.name).id, "identifiers kept");
    // The student who left is archived; their page and the sheet are intact.
    const page = await ok("agent", "GET", `/students/${gone.id}?year=all`);
    assert.equal(page.student.active, false);
    assert.deepEqual([page.record.a, page.record.history[0].note], [1, "malade"]);
    const imports = (await ok("boss", "GET", `/classes/${C}/imports`)).imports;
    assert.deepEqual(imports.map((x) => x.version), [2, 1]);
});

it("a new session starts with nothing filled in", async () => {
    const d = { classId: C, date: "2026-11-23", start: "08:00", end: "10:00", subjectId: subject, teacherId: teacher };
    sessionId = (await ok("agent", "POST", "/sessions", d)).id;
    const { session, can } = await ok("agent", "GET", `/sessions/${sessionId}`);
    assert.equal(session.roster.length, 119);
    assert.deepEqual(session.marks, {});
    assert.deepEqual(session.counts, { p: 0, r: 0, a: 0, n: 119 });
    assert.deepEqual([can.enter, can.correct], [true, false]);
    assert.equal(session.agentName, "Agent Un");

    assert.equal((await call("agent", "POST", "/sessions", d)).body.code, "DUPLICATE");
    assert.equal((await call("agent", "POST", "/sessions", { ...d, start: "09:00", end: "11:00" })).body.code, "DUPLICATE", "same subject overlapping");
    const s2 = (await ok("agent", "POST", "/subjects", { name: "Anatomie" })).id;
    assert.equal((await call("agent", "POST", "/sessions", { ...d, subjectId: s2 })).body.code, "OVERLAP");
    assert.equal((await call("agent", "POST", "/sessions", { ...d, end: "07:00" })).status, 400);
    assert.equal((await call("agent", "POST", "/sessions", { ...d, date: "2026-02-30" })).status, 400);
    // Sent twice at the same instant: one sheet only.
    const twice = { ...d, date: "2026-11-20" };
    const both = await Promise.all([call("agent", "POST", "/sessions", twice), call("agent", "POST", "/sessions", twice)]);
    assert.deepEqual(both.map((x) => x.status).sort(), [200, 409]);
});

it("marks are entered, changed and traced before validation", async () => {
    const url = `/sessions/${sessionId}/marks`;
    await ok("agent", "PATCH", url, { changes: students.slice(0, 100).map((s) => ({ id: s.id, s: "P" })) });
    await ok("agent", "PATCH", url, { changes: students.slice(100, 108).map((s) => ({ id: s.id, s: "R" })) });
    const { counts } = await ok("agent", "PATCH", url, { changes: students.slice(108, 117).map((s, i) => ({ id: s.id, s: "A", n: i ? "" : "Certificat médical" })) });
    assert.deepEqual(counts, { p: 100, r: 8, a: 9, n: 2 });
    await ok("agent", "PATCH", url, { changes: [{ id: students[0].id, s: "A" }] });
    const after = await ok("agent", "GET", `/sessions/${sessionId}`);
    assert.deepEqual(after.session.counts, { p: 99, r: 8, a: 10, n: 2 });
    assert.equal(after.session.marks[students[108].id].n, "Certificat médical");
    assert.equal(after.session.marks[students[117].id], undefined);
    const log = (await ok("agent", "GET", `/sessions/${sessionId}/audit`)).entries.find((e) => e.action === "marks.update");
    assert.deepEqual([log.changes[0].from, log.changes[0].to, log.by.name], ["P", "A", "Agent Un"]);
    assert.equal((await call("agent", "PATCH", url, { changes: [{ id: "ETU-INCONNU0", s: "P" }] })).status, 400);
    assert.equal((await call("agent", "PATCH", url, { changes: [{ id: students[0].id, s: "X" }] })).status, 400);
});

it("validation needs a confirmation, and one more for empty marks", async () => {
    const url = `/sessions/${sessionId}/validate`;
    assert.equal((await call("agent", "POST", url, {})).status, 400);
    const refused = await call("agent", "POST", url, { confirmed: true });
    assert.deepEqual([refused.status, refused.body.code, refused.body.unfilled], [409, "UNFILLED", 2]);
    await ok("agent", "POST", url, { confirmed: true, allowUnfilled: true });
    const { session, can } = await ok("agent", "GET", `/sessions/${sessionId}`);
    assert.deepEqual([session.status, session.validatedBy, session.counts.n], ["validated", "Agent Un", 2]);
    assert.deepEqual([can.enter, can.correct], [false, true]);
    assert.equal((await call("agent", "PATCH", `/sessions/${sessionId}/marks`, { changes: [{ id: students[0].id, s: "P" }] })).body.code, "VALIDATED");
    assert.equal((await call("agent", "POST", `/sessions/${sessionId}/cancel`, { reason: "erreur" })).status, 403, "an agent cannot cancel a validated sheet");
    const future = (await ok("agent", "POST", "/sessions", { classId: C, date: "2099-11-23", start: "08:00", end: "10:00", subjectId: subject, teacherId: teacher })).id;
    await ok("agent", "PATCH", `/sessions/${future}/marks`, { changes: [{ id: students[0].id, s: "P" }] });
    assert.equal((await call("agent", "POST", `/sessions/${future}/validate`, { confirmed: true, allowUnfilled: true })).status, 400);
});

it("the figures follow, from validated sheets only", async () => {
    const s = await ok("agent", "GET", `/stats?classId=${C}&from=2026-11-23&to=2026-11-23`);
    assert.deepEqual([s.class.active, s.sessions, s.totals.p, s.totals.r, s.totals.a, s.totals.n], [119, 1, 99, 8, 10, 2]);
    assert.equal(s.totals.presenceRate, 107 / 117);
    assert.equal(s.last.id, sessionId);
    assert.equal(s.drafts, 1, "this academic year only");
    assert.equal((await ok("agent", "GET", `/stats?classId=${C}`)).sessions, 2);
});

it("a correction keeps the old value, the new one, who, when and why", async () => {
    const url = `/sessions/${sessionId}/corrections`;
    const id = students[0].id;
    assert.equal((await call("agent", "POST", url, { studentId: id, from: "A", s: "P" })).status, 400, "a reason is required");
    assert.equal((await call("agent", "POST", url, { studentId: id, from: "R", s: "P", reason: "Erreur de saisie" })).body.code, "CHANGED");
    await db.collection("campusMembers").doc("agentB").set({ org: "INASS", role: "agent", name: "Agent Deux" });
    assert.equal((await call("agentB", "POST", url, { studentId: id, from: "A", s: "P", reason: "Erreur de saisie" })).status, 403, "only the agent who validated it");
    const { counts } = await ok("agent", "POST", url, { studentId: id, from: "A", s: "P", reason: "Erreur de saisie" });
    assert.deepEqual(counts, { p: 100, r: 8, a: 9, n: 2 });
    await ok("localadmin", "POST", url, { studentId: students[117].id, from: null, s: "A", n: "", reason: "Oublié sur la feuille" });
    const entries = (await ok("boss", "GET", `/sessions/${sessionId}/audit`)).entries.filter((e) => e.action === "marks.correct");
    assert.equal(entries.length, 2);
    const first = entries.find((e) => e.studentId === id);
    assert.deepEqual([first.from.s, first.to.s, first.reason, first.by.name, first.studentName], ["A", "P", "Erreur de saisie", "Agent Un", students[0].name]);
    assert.ok(first.at);
    const s = await ok("agent", "GET", `/stats?classId=${C}&from=2026-11-23&to=2026-11-23`);
    assert.deepEqual([s.totals.p, s.totals.a, s.totals.n], [100, 10, 1]);
    // After the delay, the agent no longer can; the administrator still can.
    const { Timestamp } = require("firebase-admin").firestore;
    await db.collection("campusSessions").doc(sessionId).update({ validatedAt: Timestamp.fromMillis(Date.now() - 8 * 24 * 3600 * 1000) });
    assert.equal((await call("agent", "POST", url, { studentId: id, from: "P", s: "A", reason: "Trop tard" })).status, 403);
});

it("a validated sheet is never deleted: cancelled by the administrator, and kept", async () => {
    assert.equal((await call("boss", "DELETE", `/sessions/${sessionId}`)).status, 404);
    const extra = (await ok("agent", "POST", "/sessions", { classId: C, date: "2026-11-18", start: "14:00", end: "16:00", subjectId: subject, teacherId: teacher })).id;
    await ok("agent", "PATCH", `/sessions/${extra}/marks`, { changes: [{ id: students[0].id, s: "A" }] });
    await ok("agent", "POST", `/sessions/${extra}/validate`, { confirmed: true, allowUnfilled: true });
    assert.equal((await call("boss", "POST", `/sessions/${extra}/cancel`, {})).status, 400, "a reason is required");
    await ok("boss", "POST", `/sessions/${extra}/cancel`, { reason: "Cours reporté" });
    const { session } = await ok("agent", "GET", `/sessions/${extra}`);
    assert.deepEqual([session.status, session.cancelReason, session.marks[students[0].id].s], ["cancelled", "Cours reporté", "A"]);
    assert.ok((await ok("agent", "GET", `/sessions?classId=${C}&status=cancelled`)).sessions.some((x) => x.id === extra));
    await ok("agent", "POST", "/sessions", { classId: C, date: "2026-11-18", start: "14:00", end: "16:00", subjectId: subject, teacherId: teacher });
});

it("the details of a validated sheet: administrator only, with a reason", async () => {
    const d = { date: "2026-11-23", start: "08:30", end: "10:30", subjectId: subject, teacherId: teacher };
    assert.equal((await call("agent", "PATCH", `/sessions/${sessionId}`, { ...d, reason: "horaire" })).status, 403);
    assert.equal((await call("boss", "PATCH", `/sessions/${sessionId}`, d)).status, 400);
    await ok("boss", "PATCH", `/sessions/${sessionId}`, { ...d, reason: "Horaire décalé" });
    const e = (await ok("boss", "GET", `/sessions/${sessionId}/audit`)).entries.find((x) => x.action === "session.update");
    assert.deepEqual([e.from.start, e.to.start, e.reason], ["08:00", "08:30", "Horaire décalé"]);
});

it("accounts: verified addresses only, roles limited", async () => {
    const m = { role: "agent", name: "Agent Quatre", canExport: false };
    assert.equal((await call("agent", "POST", "/members", { ...m, email: "agent2@inass.test" })).status, 403);
    assert.equal((await call("boss", "POST", "/members", { ...m, email: "inconnu@inass.test" })).status, 404);
    assert.equal((await call("boss", "POST", "/members", { ...m, email: "faux@inass.test" })).status, 400);
    assert.equal((await call("localadmin", "POST", "/members", { ...m, role: "admin", email: "agent2@inass.test" })).status, 403);
    await ok("localadmin", "POST", "/members", { ...m, email: "agent2@inass.test" });
    assert.equal((await ok("agent2", "GET", "/bootstrap")).me.canExport, false);
    assert.equal((await call("boss", "POST", "/members", { email: "prof@inass.test", role: "teacher", name: "Prof" })).status, 400, "a teacher account is tied to a teacher");
    await ok("boss", "POST", "/members", { email: "prof@inass.test", role: "teacher", name: "Prof", teacherId: teacher });
    await ok("boss", "DELETE", "/members/agent2");
    assert.equal((await call("agent2", "GET", "/bootstrap")).status, 403);
    assert.ok((await ok("boss", "GET", "/audit")).entries.some((e) => e.action === "member.remove"));
});

it("a teacher reads their own sheets, and only reads", async () => {
    const t2 = (await ok("agent", "POST", "/teachers", { name: "Mme Autre" })).id;
    const theirs = (await ok("agent", "POST", "/sessions", { classId: C, date: "2026-11-19", start: "08:00", end: "10:00", subjectId: subject, teacherId: t2 })).id;
    assert.equal((await call("prof", "GET", `/sessions/${theirs}`)).status, 404);
    assert.equal((await ok("prof", "GET", `/sessions/${sessionId}`)).session.id, sessionId);
    assert.ok((await ok("prof", "GET", `/sessions?classId=${C}`)).sessions.every((s) => s.teacherId === teacher));
    assert.deepEqual((await ok("prof", "GET", "/bootstrap")).teachers.map((t) => t.id), [teacher]);
    await ok("prof", "GET", `/stats?classId=${C}&teacherId=${t2}`).then((s) => assert.ok(s.sessions > 0 && s.recent.every((x) => x.teacherId === teacher)));
    for (const [m, u, b] of [
        ["POST", "/sessions", { classId: C }],
        ["PATCH", `/sessions/${sessionId}/marks`, { changes: [{ id: students[0].id, s: "P" }] }],
        ["POST", `/sessions/${sessionId}/corrections`, {}],
        ["POST", `/sessions/${sessionId}/cancel`, { reason: "non" }],
        ["GET", "/members", undefined],
        ["GET", "/audit", undefined],
        ["POST", "/subjects", { name: "Nouvelle" }],
        ["PATCH", `/students/${students[0].id}`, { name: "X Y", reason: "non" }],
    ]) assert.equal((await call("prof", m, u, b)).status, 403, `${m} ${u}`);
});

it("another institution sees nothing", async () => {
    assert.deepEqual((await ok("other", "GET", "/bootstrap")).classes, []);
    for (const u of [`/stats?classId=${C}`, `/sessions/${sessionId}`, `/classes/${C}/students`, `/students/${students[0].id}`, `/sessions?classId=${C}`]) assert.equal((await call("other", "GET", u)).status, 404, u);
    assert.equal((await call("other", "PATCH", `/students/${students[0].id}`, { name: "X Y", reason: "non" })).status, 404);
});

it("a corrected name keeps the identifier and the history", async () => {
    const id = students[5].id;
    await ok("boss", "PATCH", `/students/${id}`, { name: "NOM Corrigé", reason: "Faute sur la liste" });
    const page = await ok("boss", "GET", `/students/${id}`);
    assert.equal(page.student.name, "NOM Corrigé");
    assert.equal(page.student.nameHistory[0].name, names[5]);
    assert.equal(page.record.p, 1);
});

it("a draft follows a change of list without losing or inventing anything", async () => {
    const draft = (await ok("agent", "POST", "/sessions", { classId: C, date: "2026-11-17", start: "08:00", end: "10:00", subjectId: subject, teacherId: teacher })).id;
    await ok("agent", "PATCH", `/sessions/${draft}/marks`, { changes: [{ id: students[1].id, s: "P" }] });
    assert.equal((await call("boss", "POST", `/classes/${C}/students`, { name: names[10] })).body.code, "SAME_NAME");
    const added = (await ok("boss", "POST", `/classes/${C}/students`, { name: "ARRIVE Tard" })).id;
    await ok("boss", "PATCH", `/students/${students[1].id}`, { active: false, reason: "Départ" });
    await ok("boss", "PATCH", `/students/${students[2].id}`, { active: false, reason: "Départ" });
    assert.equal((await ok("agent", "GET", `/sessions/${draft}`)).rosterOutdated, true);
    await ok("agent", "POST", `/sessions/${draft}/roster`, {});
    const { session, rosterOutdated } = await ok("agent", "GET", `/sessions/${draft}`);
    const ids = session.roster.map((r) => r.id);
    assert.equal(rosterOutdated, false);
    assert.ok(ids.includes(added) && ids.includes(students[1].id) && !ids.includes(students[2].id));
    assert.deepEqual([session.marks[students[1].id].s, session.marks[added]], ["P", undefined]);
    assert.deepEqual(session.counts, { p: 1, r: 0, a: 0, n: ids.length - 1 });
});

it("scans of the paper sheet stay private", async () => {
    const sharp = require("sharp");
    const draft = (await ok("agent", "GET", `/sessions?classId=${C}&status=draft`)).sessions[0].id;
    const send = async (user, data, name, type) => {
        const form = new FormData();
        form.append("file", new Blob([data], { type }), name);
        const res = await fetch(`${base}/sessions/${draft}/scans`, { method: "POST", headers: { "x-user": user }, body: form });
        return { status: res.status, body: await res.json() };
    };
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#fff" } }).png().toBuffer();
    const up = await send("agent", png, "../../feuille.png", "image/png");
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.equal(up.body.name, "feuille.png");
    assert.equal((await send("agent", Buffer.from("<script>"), "x.jpg", "image/jpeg")).status, 400);
    assert.equal((await send("prof", png, "x.png", "image/png")).status, 403);
    const get = (user) => fetch(`${base}/sessions/${draft}/scans/${up.body.id}`, { headers: { "x-user": user } });
    const res = await get("agent");
    assert.deepEqual([res.status, res.headers.get("content-type"), res.headers.get("cache-control")], [200, "image/jpeg", "private, no-store"]);
    assert.ok((await res.arrayBuffer()).byteLength > 100);
    assert.equal((await get("other")).status, 404);
    assert.equal((await get("someone")).status, 403);
    await ok("agent", "DELETE", `/sessions/${draft}/scans/${up.body.id}`);
    assert.equal((await get("agent")).status, 404);
});

it("the timetable: drafted, published, then each course opens its own sheet", async () => {
    const { weekStart } = require("./stats");
    const { addDays } = require("./timetable");
    const { today } = require("./config");
    const past = addDays(weekStart(today()), -14);
    const t3 = (await ok("agent", "POST", "/subjects", { name: "Anglais médical" })).id;
    const periods = [{ id: "p1", label: "1ère période", start: "08:00", end: "11:00" }, { id: "p2", label: "2ème période", start: "11:30", end: "13:30" }];
    const body = { classId: C, week: past, version: 0, title: "L1", note: "Tenue obligatoire", periods, slots: [{ day: 1, periodId: "p1", subjectId: t3, teacherId: null, kind: "evaluation" }, { day: 1, periodId: "p2", subjectId: t3, teacherId: teacher }, { day: 2, periodId: "p1", subjectId: t3, teacherId: teacher }] };

    assert.equal((await call("prof", "PUT", "/timetable", body)).status, 403);
    assert.equal((await call("agent", "PUT", "/timetable", { ...body, slots: [{ day: 1, periodId: "p1", subjectId: "inconnu" }] })).status, 400);
    assert.equal((await ok("agent", "PUT", "/timetable", body)).version, 1);
    assert.equal((await call("agent", "PUT", "/timetable", body)).body.code, "CHANGED", "an older version is refused");
    assert.equal((await ok("prof", "GET", `/timetable?classId=${C}&week=${past}`)).timetable, null, "a draft is for the staff");
    assert.equal((await call("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "1-p2" })).status, 409, "not published yet");
    assert.deepEqual((await ok("agent", "GET", `/agenda?classId=${C}`)).missing, []);

    await ok("agent", "POST", "/timetable/status", { classId: C, week: past, published: true });
    const view = (await ok("agent", "GET", `/timetable?classId=${C}&week=${past}`)).timetable;
    assert.deepEqual(view.slots.map((s) => [s.id, s.state]), [["1-p1", "missing"], ["1-p2", "missing"], ["2-p1", "missing"]]);
    assert.equal((await ok("prof", "GET", `/timetable?classId=${C}&week=${past}`)).timetable.slots.length, 2, "their own courses");
    assert.equal((await ok("agent", "GET", `/agenda?classId=${C}`)).missing.length, 3);

    assert.equal((await call("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "1-p1" })).body.code, "TEACHER");
    const first = await ok("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "1-p1", teacherId: teacher });
    assert.equal(first.created, true);
    assert.deepEqual(await ok("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "1-p1" }), { id: first.id, created: false }, "the same sheet");
    const { session } = await ok("agent", "GET", `/sessions/${first.id}`);
    assert.deepEqual([session.kind, session.date, session.start, session.end, session.subjectName, Object.keys(session.marks).length], ["evaluation", past, "08:00", "11:00", "Anglais médical", 0]);

    const day = await ok("agent", "POST", "/timetable/open-day", { classId: C, date: past });
    assert.deepEqual([day.created, day.existing, day.skipped.length], [1, 1, 0]);
    const twice = await Promise.all([call("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "2-p1" }), call("agent", "POST", "/timetable/open", { classId: C, week: past, slotId: "2-p1" })]);
    assert.deepEqual(twice.map((x) => x.status), [200, 200]);
    assert.equal(twice[0].body.id, twice[1].body.id, "opened twice at once: one sheet");

    await ok("agent", "PATCH", `/sessions/${first.id}/marks`, { changes: [{ id: students[0].id, s: "A" }] });
    await ok("agent", "POST", `/sessions/${first.id}/validate`, { confirmed: true, allowUnfilled: true });
    const g = await ok("agent", "GET", `/agenda?classId=${C}`);
    assert.deepEqual(g.missing.map((s) => s.state), ["draft", "draft"], "unfinished sheets are still to do");
    const stats = await ok("agent", "GET", `/stats?classId=${C}&year=all&from=${past}&to=${past}&detail=1`);
    assert.equal(stats.events[0].kind, "evaluation");

    assert.equal((await call("agent", "POST", "/timetable/cancel", { classId: C, week: past, slotId: "2-p1", reason: "Absent" })).status, 409, "its sheet first");
    // The next week from this one: evaluations don't repeat.
    const next = addDays(past, 7);
    await ok("agent", "POST", "/timetable/copy", { classId: C, from: past, to: next });
    assert.equal((await call("agent", "POST", "/timetable/copy", { classId: C, from: past, to: next })).status, 409);
    const copy = (await ok("agent", "GET", `/timetable?classId=${C}&week=${next}`)).timetable;
    assert.deepEqual([copy.status, copy.note, copy.slots.map((s) => s.kind)], ["draft", "Tenue obligatoire", ["course", "course", "course"]]);
    await ok("agent", "POST", "/timetable/status", { classId: C, week: next, published: true });
    await ok("agent", "POST", "/timetable/cancel", { classId: C, week: next, slotId: "2-p1", reason: "Jour férié" });
    assert.equal((await call("agent", "POST", "/timetable/open", { classId: C, week: next, slotId: "2-p1" })).status, 409);
    assert.equal((await ok("agent", "GET", `/agenda?classId=${C}`)).missing.filter((s) => s.week === next).length, 2);
    await ok("agent", "POST", "/timetable/cancel", { classId: C, week: next, slotId: "2-p1", reason: null });
    assert.equal((await ok("agent", "GET", `/agenda?classId=${C}`)).missing.filter((s) => s.week === next).length, 3);

    const blank = await ok("agent", "GET", `/timetable/blank?classId=${C}&week=${next}&date=${next}`);
    assert.equal(blank.sessions.length, 2);
    assert.ok(blank.roster.length > 100);
    const other = await call("other", "GET", `/timetable?classId=${C}&week=${past}`);
    assert.equal(other.status, 404);
    const log = (await ok("boss", "GET", "/audit")).entries.map((e) => e.action);
    for (const a of ["timetable.save", "timetable.publish", "timetable.copy", "slot.cancel", "slot.restore"]) assert.ok(log.includes(a), a);
});

it("the administrator does everything, and nothing is lost by accident", async () => {
    const all = async (u) => ok("boss", "GET", u);
    const sheets = async () => (await all(`/sessions?classId=${C}&year=all`)).sessions;
    const before = (await all(`/sessions/${sessionId}`)).session;
    const reason = "Décision de la direction";
    const validated = async () => (await all(`/stats?classId=${C}&year=all`)).sessions;

    // Agents and teachers may not.
    for (const [u, b] of [[`/sessions/${sessionId}/delete`, { reason }], [`/sessions/${sessionId}/reopen`, { reason }], [`/sessions/${sessionId}/students`, { remove: [students[0].id], reason }], [`/students/${students[0].id}/delete`, { reason }], [`/classes/${C}/delete`, { reason }], [`/subjects/${subject}/delete`, { reason }], ["/timetable/delete", { classId: C, week: "2026-11-23", reason }]]) {
        for (const who of ["agent", "prof"]) assert.equal((await call(who, "POST", u, b)).status, 403, u);
        assert.ok([403, 404].includes((await call("other", "POST", u, b)).status), u);
    }
    assert.equal((await call("agent", "GET", "/trash")).status, 403);

    // Reopen, change, validate again.
    const n = await validated();
    assert.equal((await call("boss", "POST", `/sessions/${sessionId}/reopen`, {})).status, 400, "a reason is required");
    await ok("boss", "POST", `/sessions/${sessionId}/reopen`, { reason });
    assert.equal(await validated(), n - 1);
    await ok("boss", "PATCH", `/sessions/${sessionId}/marks`, { changes: [{ id: students[3].id, s: "R" }] });
    await ok("boss", "POST", `/sessions/${sessionId}/validate`, { confirmed: true, allowUnfilled: true });
    assert.equal(await validated(), n);

    // Who is on the sheet.
    await ok("boss", "POST", `/sessions/${sessionId}/students`, { remove: [students[3].id], reason });
    let sheet = (await all(`/sessions/${sessionId}`)).session;
    assert.equal(sheet.roster.length, before.roster.length - 1);
    assert.equal(sheet.marks[students[3].id], undefined);
    await ok("boss", "POST", `/sessions/${sessionId}/students`, { add: [students[3].id], reason });
    sheet = (await all(`/sessions/${sessionId}`)).session;
    assert.equal(sheet.roster.length, before.roster.length);
    assert.equal(sheet.marks[students[3].id], undefined, "added back with no status");

    // Delete a validated sheet, restore it whole, then erase another for good.
    const count = (await sheets()).length;
    await ok("boss", "POST", `/sessions/${sessionId}/delete`, { reason });
    assert.equal((await call("boss", "GET", `/sessions/${sessionId}`)).status, 404);
    assert.equal(await validated(), n - 1);
    let bin = (await all("/trash")).items;
    assert.deepEqual([bin[0].type, bin[0].reason, bin[0].by], ["session", reason, "Direction"]);
    const twin = await ok("boss", "POST", "/sessions", { classId: C, date: sheet.date, start: sheet.start, end: sheet.end, subjectId: subject, teacherId: teacher });
    assert.equal((await call("boss", "POST", `/trash/${bin[0].id}/restore`, {})).status, 409, "its place is taken");
    await ok("boss", "POST", `/sessions/${twin.id}/delete`, { reason });
    await ok("boss", "POST", `/trash/${bin[0].id}/restore`, {});
    const back = (await all(`/sessions/${sessionId}`)).session;
    assert.deepEqual([back.marks, back.counts, back.status, back.validatedBy], [sheet.marks, sheet.counts, "validated", sheet.validatedBy]);
    assert.equal((await sheets()).length, count);
    assert.equal((await call("boss", "POST", "/sessions", { classId: C, date: sheet.date, start: sheet.start, end: sheet.end, subjectId: subject, teacherId: teacher })).body.code, "DUPLICATE", "its key is back too");
    bin = (await all("/trash")).items;
    assert.equal((await call("boss", "POST", `/trash/${bin[0].id}/purge`, {})).status, 400);
    await ok("boss", "POST", `/trash/${bin[0].id}/purge`, { confirmed: true });
    assert.equal((await all("/trash")).items.length, bin.length - 1);

    // A cancelled sheet comes back.
    const cancelled = (await sheets()).find((s) => s.status === "cancelled");
    const inTheWay = (await sheets()).find((s) => s.status !== "cancelled" && s.date === cancelled.date && s.start === cancelled.start);
    if (inTheWay) {
        assert.equal((await call("boss", "POST", `/sessions/${cancelled.id}/restore`, { reason })).status, 409);
        await ok("boss", "POST", `/sessions/${inTheWay.id}/delete`, { reason });
    }
    await ok("boss", "POST", `/sessions/${cancelled.id}/restore`, { reason });
    assert.equal((await all(`/sessions/${cancelled.id}`)).session.status, "validated");

    // A student: number, deletion with or without the sheets, return.
    const st = students[40];
    assert.equal((await call("boss", "PATCH", `/students/${st.id}`, { no: students[41].no, reason })).status, 409);
    await ok("boss", "PATCH", `/students/${st.id}`, { no: 900, reason });
    const record = (await all(`/students/${st.id}?year=all`)).record;
    const r = await ok("boss", "POST", `/students/${st.id}/delete`, { reason, fromSheets: true });
    assert.ok(r.sheets > 0);
    assert.ok(!(await all(`/sessions/${sessionId}`)).session.roster.some((x) => x.id === st.id));
    assert.equal((await call("boss", "GET", `/students/${st.id}`)).status, 404);
    bin = (await all("/trash")).items;
    await ok("boss", "POST", `/trash/${bin.find((b) => b.type === "student").id}/restore`, {});
    assert.deepEqual((await all(`/students/${st.id}?year=all`)).record, record, "with every status");
    await ok("boss", "POST", `/students/${students[41].id}/delete`, { reason });
    assert.ok((await all(`/sessions/${sessionId}`)).session.roster.some((x) => x.id === students[41].id), "the sheets keep them");

    // Subjects: rename everywhere, replace, delete.
    const old = (await ok("boss", "POST", "/subjects", { name: "Biologie" })).id;
    const s1 = (await ok("boss", "POST", "/sessions", { classId: C, date: "2026-10-01", start: "08:00", end: "10:00", subjectId: old, teacherId: teacher })).id;
    await ok("boss", "POST", `/subjects/${old}/rename`, { name: "Biologie médicale" });
    assert.equal((await all(`/sessions/${s1}`)).session.subjectName, "Biologie médicale");
    assert.equal((await call("boss", "POST", `/subjects/${old}/rename`, { name: "ANATOMIE" })).body.code, "SAME_NAME");
    const again = (await ok("boss", "POST", "/subjects", { name: "Biologie" })).id;
    assert.notEqual(again, old, "the former name is free again");
    const refused = await call("boss", "POST", `/subjects/${old}/delete`, { reason });
    assert.deepEqual([refused.body.code, refused.body.usage.sheets], ["IN_USE", 1]);
    await ok("boss", "POST", `/subjects/${old}/delete`, { reason, replaceBy: again });
    const moved = (await all(`/sessions/${s1}`)).session;
    assert.deepEqual([moved.subjectId, moved.subjectName], [again, "Biologie"]);
    assert.equal((await call("boss", "POST", "/sessions", { classId: C, date: "2026-10-01", start: "08:00", end: "10:00", subjectId: again, teacherId: teacher })).body.code, "DUPLICATE");
    await ok("boss", "POST", "/sessions/" + s1 + "/delete", { reason });
    await ok("boss", "POST", `/subjects/${again}/delete`, { reason });
    assert.ok(!(await all("/bootstrap")).subjects.some((x) => x.id === again || x.id === old));

    // Timetables and classes.
    const weeks = (await all(`/timetable?classId=${C}`)).weeks;
    await ok("boss", "POST", "/timetable/delete", { classId: C, week: weeks[0].week, reason });
    assert.equal((await all(`/timetable?classId=${C}`)).weeks.length, weeks.length - 1);
    await ok("boss", "POST", `/trash/${(await all("/trash")).items.find((b) => b.type === "timetable").id}/restore`, {});
    assert.equal((await call("boss", "POST", `/classes/${C}/delete`, { reason })).status, 409, "a class with sheets");
    const c2 = (await ok("boss", "POST", "/classes", { code: "PB1", label: "Pré-BAC 1", expected: 2 })).id;
    const p = await ok("boss", "POST", `/classes/${c2}/import/preview`, { text: "1. ONDO Zoé\n2. MBA Paul", expected: 2 });
    await ok("boss", "POST", `/classes/${c2}/import`, { text: "1. ONDO Zoé\n2. MBA Paul", expected: 2, hash: p.hash, confirmed: true });
    await ok("boss", "PATCH", `/classes/${c2}`, { code: "PRE1", label: "Pré-BAC" });
    assert.equal((await call("boss", "PATCH", `/classes/${c2}`, { code: "l1" })).status, 409);
    await ok("boss", "POST", `/classes/${c2}/delete`, { reason });
    assert.equal((await call("boss", "GET", `/classes/${c2}/students`)).status, 404);
    await ok("boss", "POST", `/trash/${(await all("/trash")).items.find((b) => b.type === "class").id}/restore`, {});
    assert.equal((await all(`/classes/${c2}/students`)).students.length, 2);

    // Everything is in the log, and nothing erases the log.
    const log = (await all("/audit")).entries.map((e) => e.action);
    for (const a of ["session.reopen", "session.students", "session.delete", "session.restore", "student.delete", "subject.delete", "timetable.delete", "class.delete", "trash.restore", "trash.purge"]) assert.ok(log.includes(a), a);
    assert.equal((await call("boss", "DELETE", "/audit")).status, 404);
});
