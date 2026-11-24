// Attendance figures. Pure. Only validated sessions count, and only the
// statuses actually entered: an empty mark is neither present nor absent.
//
//   taux de présence = (présents + retards) / statuts renseignés
//   taux d'absence   = absents / statuts renseignés

const { SESSION } = require("./config");

const empty = () => ({ p: 0, r: 0, a: 0, n: 0 });

function rates(c) {
    const rated = c.p + c.r + c.a;
    return {
        ...c,
        rated,
        presenceRate: rated ? (c.p + c.r) / rated : null,
        absenceRate: rated ? c.a / rated : null,
        lateRate: rated ? c.r / rated : null,
    };
}

function add(c, status) {
    if (status === "P") c.p++;
    else if (status === "R") c.r++;
    else if (status === "A") c.a++;
    else c.n++;
}

// Counts of one sheet, « non renseigné » included.
function countMarks(roster, marks) {
    const c = empty();
    for (const s of roster) add(c, marks?.[s.id]?.s);
    return c;
}

// The Monday of a date's week (YYYY-MM-DD).
function weekStart(date) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
}

// Latest first.
function byDateDesc(a, b) {
    const [x, y] = [`${a.date} ${a.start}`, `${b.date} ${b.start}`];
    return x < y ? 1 : x > y ? -1 : 0;
}

function filterSessions(sessions, { from, to, subjectId, teacherId } = {}) {
    return sessions.filter(
        (s) => (!from || s.date >= from) && (!to || s.date <= to) && (!subjectId || s.subjectId === subjectId) && (!teacherId || s.teacherId === teacherId),
    );
}

function computeStats(allSessions, students, filters = {}) {
    const sessions = filterSessions(allSessions, filters)
        .filter((s) => s.status === SESSION.VALIDATED)
        .sort(byDateDesc);
    const totals = empty();
    const weeks = new Map();
    const months = new Map();
    const subjects = new Map();
    const perStudent = new Map(students.map((s) => [s.id, { id: s.id, name: s.name, no: s.importNo ?? null, active: s.active !== false, sessions: 0, ...empty() }]));

    const bucket = (map, key, extra) => {
        if (!map.has(key)) map.set(key, { ...extra, sessions: 0, ...empty() });
        return map.get(key);
    };

    for (const session of sessions) {
        const monday = weekStart(session.date);
        const week = bucket(weeks, monday, { week: monday });
        const month = bucket(months, session.date.slice(0, 7), { month: session.date.slice(0, 7) });
        const subject = bucket(subjects, session.subjectId, { id: session.subjectId, name: session.subjectName });
        for (const b of [week, month, subject]) b.sessions++;
        for (const s of session.roster) {
            const status = session.marks?.[s.id]?.s;
            if (!perStudent.has(s.id)) perStudent.set(s.id, { id: s.id, name: s.name, no: s.no ?? null, active: false, sessions: 0, ...empty() });
            const student = perStudent.get(s.id);
            student.sessions++;
            for (const c of [totals, week, month, subject, student]) add(c, status);
        }
    }

    const list = (map) => [...map.values()].map(rates);
    const by = (key) => (x, y) => (x[key] < y[key] ? -1 : x[key] > y[key] ? 1 : 0);
    return {
        sessions: sessions.length,
        totals: rates(totals),
        weeks: list(weeks).sort(by("week")),
        months: list(months).sort(by("month")),
        subjects: list(subjects).sort((x, y) => x.name.localeCompare(y.name, "fr")),
        students: list(perStudent)
            .filter((s) => s.active || s.sessions)
            .sort((x, y) => (x.no ?? 1e9) - (y.no ?? 1e9) || x.name.localeCompare(y.name, "fr")),
    };
}

// Every absence and late arrival, oldest first (monthly report).
function listEvents(allSessions, students, filters = {}) {
    const names = new Map(students.map((s) => [s.id, s.name]));
    const out = [];
    for (const s of filterSessions(allSessions, filters).sort((a, b) => byDateDesc(b, a))) {
        if (s.status !== SESSION.VALIDATED) continue;
        for (const r of s.roster) {
            const m = s.marks?.[r.id];
            if (m?.s === "A" || m?.s === "R") out.push({ date: s.date, start: s.start, subjectName: s.subjectName, id: r.id, name: names.get(r.id) || r.name, status: m.s, note: m.n || "" });
        }
    }
    return out;
}

// One student's own record.
function studentRecord(allSessions, studentId, filters = {}) {
    const c = empty();
    const history = [];
    for (const s of filterSessions(allSessions, filters).sort(byDateDesc)) {
        if (s.status !== SESSION.VALIDATED || !s.roster.some((r) => r.id === studentId)) continue;
        const mark = s.marks?.[studentId];
        add(c, mark?.s);
        history.push({
            sessionId: s.id,
            date: s.date,
            start: s.start,
            end: s.end,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            teacherName: s.teacherName,
            status: mark?.s ?? null,
            note: mark?.n ?? "",
        });
    }
    return { sessions: history.length, ...rates(c), history };
}

module.exports = { countMarks, computeStats, listEvents, studentRecord, weekStart, filterSessions, byDateDesc, rates };
