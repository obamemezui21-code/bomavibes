const express = require("express");
const multer = require("multer");
const { ZodError } = require("zod");
const requireFirebaseAuth = require("../middleware/firebaseAuthMiddleware");
const { limiter } = require("../middleware/rateLimits");
const { campusAccess, requireCampus, requireStaff, requireCampusAdmin } = require("./access");
const { CONFIG, HttpError } = require("./config");
const roster = require("./rosterController");
const sessions = require("./sessionController");
const people = require("./adminController");
const timetable = require("./timetableController");
const actions = require("./adminActions");
const scans = require("./scanController");

// /api/campus — BomaVibes Campus, attendance. Mounted in app.js.

const MINUTE = 60 * 1000;
const campusLimiter = limiter({
    windowMs: 10 * MINUTE,
    limit: 900,
    message: "Trop de requêtes, réessayez dans quelques minutes.",
    keyGenerator: (req) => `campus:${req.firebaseUser.uid}`,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CONFIG.maxScanBytes, files: 1, fields: 2 } });
function uploadScan(req, res, next) {
    upload.single("file")(req, res, (err) => {
        if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: `Fichier trop lourd (maximum ${Math.round(CONFIG.maxScanBytes / 1024 / 1024)} Mo).` });
        if (err) return res.status(400).json({ message: "Fichier refusé." });
        next();
    });
}

// Runs an action and answers with its result; expected refusals become their
// message, anything else a 500 that says nothing.
const run = (action) => async (req, res) => {
    try {
        const result = await action(req, res);
        if (!res.headersSent) res.json(result ?? { ok: true });
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ message: err.message, ...err.extra });
        if (err instanceof ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Données invalides." });
        console.error("Campus:", err);
        res.status(500).json({ message: "Une erreur interne est survenue. Rien n’a été enregistré." });
    }
};

const router = express.Router();
router.use(requireFirebaseAuth, campusLimiter);

// Whether this account may use Campus (answers even when it may not).
router.get("/me", run(async (req) => ({ allowed: (await campusAccess(req.firebaseUser)).allowed })));

router.use(requireCampus);
router.get("/bootstrap", run((req) => people.bootstrap(req.campus)));
router.get("/stats", run((req) => sessions.stats(req.campus, req.query)));

// Classes and students
router.post("/classes", requireCampusAdmin, run((req) => roster.createClass(req.campus, req.body)));
router.patch("/classes/:id", requireCampusAdmin, run((req) => roster.updateClass(req.campus, req.params.id, req.body)));
router.get("/classes/:id/students", run(async (req) => ({ students: await roster.students(req.campus, req.params.id) })));
router.post("/classes/:id/students", requireCampusAdmin, run((req) => roster.addStudent(req.campus, req.params.id, req.body)));
router.post("/classes/:id/import/preview", requireCampusAdmin, run((req) => roster.previewImport(req.campus, req.params.id, req.body)));
router.post("/classes/:id/import", requireCampusAdmin, run((req) => roster.runImport(req.campus, req.params.id, req.body)));
router.get("/classes/:id/imports", requireCampusAdmin, run(async (req) => ({ imports: await roster.listImports(req.campus, req.params.id) })));
router.get("/students/:id", run((req) => roster.studentPage(req.campus, req.params.id, req.query)));
router.patch("/students/:id", requireCampusAdmin, run((req) => roster.updateStudent(req.campus, req.params.id, req.body)));

// Sessions and sheets
router.get("/sessions", run((req) => sessions.listSessions(req.campus, req.query)));
router.post("/sessions", requireStaff, run((req) => sessions.createSession(req.campus, req.body || {})));
router.get("/sessions/:id", run((req) => sessions.getSession(req.campus, req.params.id)));
router.patch("/sessions/:id", requireStaff, run((req) => sessions.updateDetails(req.campus, req.params.id, req.body || {})));
router.patch("/sessions/:id/marks", requireStaff, run((req) => sessions.saveMarks(req.campus, req.params.id, req.body)));
router.post("/sessions/:id/validate", requireStaff, run((req) => sessions.validateSession(req.campus, req.params.id, req.body || {})));
router.post("/sessions/:id/corrections", requireStaff, run((req) => sessions.correctMark(req.campus, req.params.id, req.body || {})));
router.post("/sessions/:id/cancel", requireStaff, run((req) => sessions.cancelSession(req.campus, req.params.id, req.body || {})));
router.post("/sessions/:id/roster", requireStaff, run((req) => sessions.syncRoster(req.campus, req.params.id)));
router.get("/sessions/:id/audit", run(async (req) => ({ entries: await sessions.sessionAudit(req.campus, req.params.id) })));
router.post("/sessions/:id/scans", requireStaff, uploadScan, run((req) => scans.addScan(req.campus, req.params.id, req.file)));
router.delete("/sessions/:id/scans/:scanId", requireStaff, run((req) => scans.removeScan(req.campus, req.params.id, req.params.scanId)));
router.get(
    "/sessions/:id/scans/:scanId",
    run(async (req, res) => {
        const { file, type } = await scans.scanFile(req.campus, req.params.id, req.params.scanId);
        res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        res.type(type).sendFile(file, { dotfiles: "allow" });
        return new Promise((resolve) => res.once("close", resolve));
    }),
);

// The weekly timetable, and the sheets it prepares
router.get("/agenda", run((req) => timetable.getAgenda(req.campus, req.query)));
router.get("/timetable", run((req) => timetable.getTimetable(req.campus, req.query)));
router.put("/timetable", requireStaff, run((req) => timetable.saveTimetable(req.campus, req.body)));
router.post("/timetable/status", requireStaff, run((req) => timetable.setStatus(req.campus, req.body)));
router.post("/timetable/copy", requireStaff, run((req) => timetable.copyTimetable(req.campus, req.body)));
router.post("/timetable/cancel", requireStaff, run((req) => timetable.cancelSlot(req.campus, req.body)));
router.post("/timetable/open", requireStaff, run((req) => timetable.openSlot(req.campus, req.body)));
router.post("/timetable/open-day", requireStaff, run((req) => timetable.openDay(req.campus, req.body)));
router.get("/timetable/blank", requireStaff, run((req) => timetable.blankSheets(req.campus, req.query)));

// Subjects and teachers: agents may add one while creating a session; only
// the administrator renames or retires them.
for (const kind of ["subjects", "teachers"]) {
    router.post(`/${kind}`, requireStaff, run((req) => people.addNamed(req.campus, kind, req.body)));
    router.patch(`/${kind}/:id`, requireCampusAdmin, run((req) => people.updateNamed(req.campus, kind, req.params.id, req.body)));
}

// The administrator's: reopen, restore, replace, delete (through the bin).
router.post("/sessions/:id/delete", requireCampusAdmin, run((req) => actions.deleteSession(req.campus, req.params.id, req.body)));
router.post("/sessions/:id/reopen", requireCampusAdmin, run((req) => actions.reopenSession(req.campus, req.params.id, req.body)));
router.post("/sessions/:id/restore", requireCampusAdmin, run((req) => actions.restoreSession(req.campus, req.params.id, req.body)));
router.post("/sessions/:id/students", requireCampusAdmin, run((req) => actions.updateSheetStudents(req.campus, req.params.id, req.body)));
router.post("/students/:id/delete", requireCampusAdmin, run((req) => actions.deleteStudent(req.campus, req.params.id, req.body)));
router.post("/classes/:id/delete", requireCampusAdmin, run((req) => actions.deleteClass(req.campus, req.params.id, req.body)));
router.post("/timetable/delete", requireCampusAdmin, run((req) => actions.deleteTimetable(req.campus, req.body)));
for (const kind of ["subjects", "teachers"]) {
    router.post(`/${kind}/:id/rename`, requireCampusAdmin, run((req) => actions.renameEverywhere(req.campus, kind, req.params.id, req.body)));
    router.post(`/${kind}/:id/delete`, requireCampusAdmin, run((req) => actions.deleteNamed(req.campus, kind, req.params.id, req.body)));
}
router.get("/trash", requireCampusAdmin, run(async (req) => ({ items: await actions.listTrash(req.campus) })));
router.post("/trash/:id/restore", requireCampusAdmin, run((req) => actions.restoreTrash(req.campus, req.params.id)));
router.post("/trash/:id/purge", requireCampusAdmin, run((req) => actions.purgeTrash(req.campus, req.params.id, req.body)));

// Staff accounts and the log
router.get("/members", requireCampusAdmin, run(async (req) => ({ members: await people.listMembers(req.campus) })));
router.post("/members", requireCampusAdmin, run((req) => people.setMember(req.campus, req.body)));
router.delete("/members/:uid", requireCampusAdmin, run((req) => people.removeMember(req.campus, req.params.uid)));
router.get("/audit", requireCampusAdmin, run(async (req) => ({ entries: await people.listAudit(req.campus) })));

module.exports = router;
