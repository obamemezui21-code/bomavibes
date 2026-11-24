// The weekly timetable (emploi du temps) of a class: what it holds, which
// sheet goes with each course, what is still to be entered. Pure.

const { z } = require("zod");
const { SESSION, isDate, isTime, CONFIG } = require("./config");
const { weekStart } = require("./stats");

// The institution's usual day; each week may have its own.
const DEFAULT_PERIODS = Object.freeze([
    { id: "p1", label: "1ère période", start: "08:00", end: "11:00" },
    { id: "p2", label: "2ème période", start: "11:30", end: "13:30" },
    { id: "p3", label: "3ème période", start: "14:00", end: "16:00" },
]);
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const isMonday = (d) => isDate(d) && weekStart(d) === d;

function addDays(date, n) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

const PeriodSchema = z
    .object({ id: z.string().regex(/^p\d{1,2}$/), label: z.string().trim().min(1).max(40), start: z.string().refine(isTime, "Heure de début invalide."), end: z.string().refine(isTime, "Heure de fin invalide.") })
    .refine((p) => p.end > p.start, { message: "Une période doit finir après son début." });

const SlotSchema = z.object({
    day: z.number().int().min(1).max(6),
    periodId: z.string(),
    subjectId: z.string().min(1, "Choisissez la matière."),
    teacherId: z.string().min(1).nullable().default(null),
    kind: z.enum(["course", "evaluation"]).default("course"),
});

const TimetableSchema = z
    .object({
        classId: z.string(),
        week: z.string().refine(isMonday, "La semaine doit commencer un lundi."),
        version: z.number().int().min(0),
        title: z.string().trim().max(120).default(""),
        note: z.string().trim().max(1000).default(""),
        periods: z.array(PeriodSchema).min(1, "Ajoutez une période.").max(8),
        slots: z.array(SlotSchema).max(48),
    })
    .superRefine((t, ctx) => {
        const bad = (message) => ctx.addIssue({ code: "custom", message });
        const sorted = [...t.periods].sort((a, b) => (a.start < b.start ? -1 : 1));
        for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) bad(`« ${sorted[i - 1].label} » et « ${sorted[i].label} » se chevauchent.`);
        const ids = new Set(t.periods.map((p) => p.id));
        if (ids.size !== t.periods.length) bad("Deux périodes portent le même identifiant.");
        const cells = new Set();
        for (const s of t.slots) {
            if (!ids.has(s.periodId)) bad("Un cours est placé sur une période qui n’existe pas.");
            const cell = slotId(s);
            if (cells.has(cell)) bad("Deux cours occupent la même case.");
            cells.add(cell);
        }
    });

const slotId = (s) => `${s.day}-${s.periodId}`;

// The courses of a week, in order, each with its date and hours.
function slotsOf(timetable) {
    const periods = new Map(timetable.periods.map((p) => [p.id, p]));
    return timetable.slots
        .filter((s) => periods.has(s.periodId))
        .map((s) => {
            const p = periods.get(s.periodId);
            return { ...s, id: slotId(s), week: timetable.week, date: addDays(timetable.week, s.day - 1), start: p.start, end: p.end, periodLabel: p.label };
        })
        .sort((a, b) => (`${a.date} ${a.start}` < `${b.date} ${b.start}` ? -1 : 1));
}

// The sheet of a course: same day, same subject, hours that overlap. Linked by
// what they are, not by a reference: a sheet made by hand counts too.
function sessionOf(slot, sessions) {
    const found = sessions.filter((s) => s.status !== SESSION.CANCELLED && s.date === slot.date && s.subjectId === slot.subjectId && s.start < slot.end && slot.start < s.end);
    return found.find((s) => s.start === slot.start) || found[0] || null;
}

// cancelled | validated | draft | upcoming | now | missing
function slotState(slot, session, now) {
    if (session?.status === SESSION.VALIDATED) return "validated";
    if (session) return "draft";
    if (slot.cancelled) return "cancelled";
    if (slot.date > now.date || (slot.date === now.date && now.time < slot.start)) return "upcoming";
    if (slot.date === now.date && now.time < slot.end) return "now";
    return "missing";
}

function withState(slot, sessions, now) {
    const session = sessionOf(slot, sessions);
    // Not on the timetable, but known once the sheet is open.
    const teacherName = slot.teacherName || session?.teacherName || null;
    return { ...slot, teacherName, state: slotState(slot, session, now), sessionId: session?.id || null, counts: session?.counts || null };
}

// Date and time in Libreville.
function localNow(now = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Today's courses, the sheets still missing, and how the week is going.
function agenda(timetables, sessions, now) {
    const all = timetables
        .flatMap((t) => slotsOf(t))
        .map((s) => withState(s, sessions, now))
        .sort((a, b) => (`${a.date} ${a.start}` < `${b.date} ${b.start}` ? -1 : 1));
    const week = weekStart(now.date);
    const ofWeek = all.filter((s) => s.week === week && s.state !== "cancelled");
    const ended = (s) => s.date < now.date || (s.date === now.date && s.end <= now.time);
    const next = all.find((s) => s.date > now.date && s.state !== "cancelled");
    return {
        today: all.filter((s) => s.date === now.date),
        // Over, and not validated: no sheet, or one left unfinished.
        missing: all.filter((s) => s.date < now.date && (s.state === "missing" || (s.state === "draft" && ended(s)))).reverse(),
        next: next ? { date: next.date, slots: all.filter((s) => s.date === next.date) } : null,
        week: { week, total: ofWeek.length, validated: ofWeek.filter((s) => s.state === "validated").length },
    };
}

// What changed between two versions, in words, for the log.
function describeChanges(before, after) {
    const label = (s) => (s ? `${s.kind === "evaluation" ? "Évaluation " : ""}${s.subjectName}${s.teacherName ? ` (${s.teacherName})` : ""}` : "—");
    const old = new Map((before?.slots || []).map((s) => [slotId(s), s]));
    const now = new Map(after.slots.map((s) => [slotId(s), s]));
    const lines = [];
    for (const id of new Set([...old.keys(), ...now.keys()])) {
        const [a, b] = [label(old.get(id)), label(now.get(id))];
        if (a === b) continue;
        const [day, periodId] = id.split("-");
        const period = [...after.periods, ...(before?.periods || [])].find((p) => p.id === periodId);
        lines.push(`${DAYS[day - 1]}, ${period?.label || periodId} : ${a} → ${b}`);
    }
    const hours = (t) => (t?.periods || []).map((p) => `${p.label} ${p.start}–${p.end}`).join(", ");
    if (before && hours(before) !== hours(after)) lines.push(`Horaires : ${hours(before)} → ${hours(after)}`);
    if (before && (before.note || "") !== (after.note || "")) lines.push("Note modifiée");
    if (before && (before.title || "") !== (after.title || "")) lines.push(`Titre : ${before.title || "—"} → ${after.title || "—"}`);
    return lines;
}

module.exports = { DEFAULT_PERIODS, DAYS, TimetableSchema, isMonday, addDays, slotId, slotsOf, sessionOf, slotState, withState, localNow, agenda, describeChanges };
