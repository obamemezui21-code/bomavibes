// BomaVibes Campus — attendance (présences). Settings and small pure helpers.

const CONFIG = Object.freeze({
    // The institution a BomaVibes admin manages; members carry their own.
    defaultOrg: "INASS",
    defaultClass: { code: "L1", label: "Licence 1", expected: 119 },
    timeZone: "Africa/Libreville",
    // An agent may correct the sheets they validated for this long; an
    // administrator, any time. Always with a reason.
    agentCorrectionDays: 7,
    maxScans: 10,
    maxScanBytes: 12 * 1024 * 1024,
    maxRoster: 400,
});

// Presence statuses. There is no default: a student with no mark is
// « Non renseigné », never counted as present or absent.
const STATUS = Object.freeze({ P: "Présent", R: "Retard", A: "Absent" });

const SESSION = Object.freeze({ DRAFT: "draft", VALIDATED: "validated", CANCELLED: "cancelled" });

// Spelling-insensitive form of a name, only to compare and search. What is
// stored and shown is always the name exactly as given.
function nameKey(name) {
    return String(name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

const slug = (s) => nameKey(s).replace(/ /g, "-");

// Today, in Libreville, as YYYY-MM-DD.
function today(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");

// The academic year a date belongs to: September to August.
function academicYear(date) {
    const [y, m] = date.split("-").map(Number);
    return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

module.exports = { CONFIG, STATUS, SESSION, nameKey, slug, today, isDate, isTime, academicYear, HttpError };
