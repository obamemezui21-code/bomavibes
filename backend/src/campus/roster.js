// Reading the official list of a class, its checks, and what importing it
// would change. Pure: nothing here touches the database, and nothing is ever
// merged — two names that look alike are reported and stay two students.

const crypto = require("crypto");
const { CONFIG, nameKey } = require("./config");

// « 12. NOM Prénom » (also « 12) », « 12 - », « 12<tab> »), one per line.
// Spelling, accents and capitals are kept as typed; only the spaces around
// and between words are tidied.
function parseRoster(text) {
    const entries = [];
    String(text ?? "")
        .normalize("NFC")
        .split(/\r?\n/)
        .forEach((raw, i) => {
            const line = raw.replace(/[\s\u00a0\u202f]+/g, " ").trim();
            if (!line) return;
            const m = /^(\d{1,4})(?:\s*[.):;-]\s*|\s+|$)(.*)$/.exec(line);
            entries.push(m ? { line: i + 1, no: Number(m[1]), name: m[2].trim() } : { line: i + 1, no: null, name: line });
        });
    return entries;
}

// Edit distance, given up past `max`.
function distance(a, b, max = Infinity) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (row[j] < best) best = row[j];
        }
        if (best > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
}

const SAME = "même nom";

// Why two names look like the same person, or null.
function similarity(nameA, nameB) {
    const [a, b] = [nameKey(nameA), nameKey(nameB)];
    if (!a || !b) return null;
    if (a === b) return SAME;
    const [ta, tb] = [a.split(" "), b.split(" ")];
    if ([...ta].sort().join(" ") === [...tb].sort().join(" ")) return "mêmes mots, dans un autre ordre";
    const [x, y] = [a.replace(/ /g, ""), b.replace(/ /g, "")];
    const max = Math.max(2, Math.floor(Math.max(x.length, y.length) * 0.12));
    const d = distance(x, y, max);
    if (d <= max) return d <= 1 ? "une lettre de différence" : `${d} lettres de différence`;
    const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (small.length >= 2 && small.every((t) => big.includes(t))) return "l’un est contenu dans l’autre";
    return null;
}

// The checks made before anything is imported. level "error" blocks the
// import; "warning" and "info" are shown, and left to a person to judge.
function checkRoster(entries, expected) {
    const anomalies = [];
    const add = (level, code, message, lines = []) => anomalies.push({ level, code, message, lines });

    for (const e of entries) {
        if (e.no === null) add("error", "no_number", `Ligne ${e.line} sans numéro : « ${e.name} ».`, [e.line]);
        if (!e.name) add("error", "empty", `N° ${e.no} : le nom est vide.`, [e.line]);
        else if (!/\p{L}/u.test(e.name)) add("error", "unreadable", `N° ${e.no} : « ${e.name} » n’est pas un nom.`, [e.line]);
        else if (/[^\p{L}\p{M}\s'’.-]/u.test(e.name)) add("warning", "odd_char", `N° ${e.no} : caractère inhabituel dans « ${e.name} ».`, [e.line]);
    }

    const numbered = entries.filter((e) => e.no !== null);
    const byNo = new Map();
    for (const e of numbered) byNo.set(e.no, [...(byNo.get(e.no) || []), e]);
    for (const [no, list] of byNo) {
        if (list.length > 1) add("error", "dup_number", `Le numéro ${no} apparaît ${list.length} fois.`, list.map((e) => e.line));
    }
    const missing = [];
    for (let n = 1; n <= expected; n++) if (!byNo.has(n)) missing.push(n);
    const listed = (nos) => `${nos.slice(0, 30).join(", ")}${nos.length > 30 ? "…" : ""}`;
    if (missing.length) add("error", "missing_number", `Numéros manquants : ${listed(missing)}.`);
    const extra = [...byNo.keys()].filter((n) => n < 1 || n > expected).sort((a, b) => a - b);
    if (extra.length) add("error", "extra_number", `Numéros hors de 1 à ${expected} : ${listed(extra)}.`);
    if (entries.length !== expected) add("error", "count", `${entries.length} étudiant${entries.length > 1 ? "s" : ""} dans la liste, ${expected} attendus.`);
    if (entries.length > CONFIG.maxRoster) add("error", "too_many", `Liste trop longue (maximum ${CONFIG.maxRoster}).`);

    const similar = [];
    const named = entries.filter((e) => e.name).slice(0, CONFIG.maxRoster);
    for (let i = 0; i < named.length; i++) {
        for (let j = i + 1; j < named.length; j++) {
            const why = similarity(named[i].name, named[j].name);
            if (!why) continue;
            const [a, b] = [named[i], named[j]];
            if (why === SAME) {
                add("error", "duplicate", `Doublon exact : n° ${a.no} et n° ${b.no}, « ${a.name} ».`, [a.line, b.line]);
            } else {
                similar.push({ a: { no: a.no, name: a.name }, b: { no: b.no, name: b.name }, why });
                add("warning", "similar", `Noms proches, gardés séparés : n° ${a.no} « ${a.name} » et n° ${b.no} « ${b.name} » (${why}).`, [a.line, b.line]);
            }
        }
    }
    // Names are usually NOM in capitals then Prénom: one entirely in capitals
    // may be complete, or may lack a first name.
    for (const e of named) {
        if (/\p{L}/u.test(e.name) && !/\p{Ll}/u.test(e.name)) add("info", "caps", `N° ${e.no} « ${e.name} » : tout en majuscules, nom et prénom ne se distinguent pas.`, [e.line]);
    }

    const errors = anomalies.filter((a) => a.level === "error").length;
    return {
        expected,
        count: entries.length,
        firstNo: byNo.size ? Math.min(...byNo.keys()) : null,
        lastNo: byNo.size ? Math.max(...byNo.keys()) : null,
        anomalies,
        similar,
        errors,
        ok: errors === 0,
    };
}

// What the import would change. A student already in the class is recognised
// only when the name is the same (accents, capitals and punctuation aside);
// they keep their identifier and their history. Anyone else is added, and
// whoever left the list is archived — never deleted.
function planImport(entries, existing) {
    const byKey = new Map();
    for (const s of existing) byKey.set(nameKey(s.name), [...(byKey.get(nameKey(s.name)) || []), s]);
    const used = new Set();
    const kept = [];
    const added = [];
    for (const e of entries) {
        const found = (byKey.get(nameKey(e.name)) || []).filter((s) => !used.has(s.id));
        if (found.length === 1) {
            used.add(found[0].id);
            kept.push({ id: found[0].id, no: e.no, name: e.name, oldName: found[0].name, renamed: found[0].name !== e.name, wasArchived: !found[0].active });
        } else {
            added.push({ no: e.no, name: e.name });
        }
    }
    const archived = existing.filter((s) => s.active && !used.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
    // A new name close to one leaving the list may be the same person with a
    // corrected spelling: said, never assumed.
    const toReconcile = [];
    for (const n of added) {
        for (const old of archived) {
            const why = similarity(n.name, old.name);
            if (why) toReconcile.push({ no: n.no, name: n.name, oldId: old.id, oldName: old.name, why });
        }
    }
    return { kept, added, archived, toReconcile };
}

// Ties a confirmation to exactly what was shown in the report.
function rosterHash(entries, classId, rosterVersion) {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify([classId, rosterVersion || 0, entries.map((e) => [e.no, e.name])]))
        .digest("hex");
}

// « ETU-7K3F9Q2M »: the technical identifier. Random, so it carries neither
// the list number nor anything about the person.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function newStudentId() {
    return `ETU-${Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % 32]).join("")}`;
}

module.exports = { parseRoster, checkRoster, planImport, rosterHash, newStudentId, similarity, distance };
