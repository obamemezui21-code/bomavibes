const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const { CONFIG, HttpError } = require("./config");
const { db, FieldValue, who, auditEntry, newAudit, dropCache } = require("./store");
const { readSession, permissions } = require("./sessionController");

// Photos and scans of the paper sheets. Private: kept in backend/private
// (never served by nginx, never in git), sent only to accounts that may read
// the session. They are there for the agent to look at: nothing is read from
// them automatically, and no status ever comes from them.

const ROOT = process.env.CAMPUS_SCANS_DIR || path.join(__dirname, "..", "..", "private", "campus-scans");

const dirOf = (sessionId) => path.join(ROOT, sessionId);
const fileOf = (sessionId, scan) => path.join(dirOf(sessionId), `${scan.id}.${scan.kind}`);

async function addScan(access, id, file) {
    if (!file) throw new HttpError(400, "Aucun fichier reçu.");
    const { s } = await readSession(null, access, id);
    if (!permissions(access, s).scans) throw new HttpError(403, "Vous ne pouvez pas ajouter de feuille à cette séance.");
    if ((s.scans || []).length >= CONFIG.maxScans) throw new HttpError(400, `Maximum ${CONFIG.maxScans} images par séance.`);

    let kind = "jpg";
    let data = file.buffer;
    if (data.subarray(0, 5).toString("latin1") === "%PDF-") {
        kind = "pdf";
    } else {
        try {
            // Re-encoded: upright, readable, without the photo's GPS position.
            data = await sharp(data).rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        } catch {
            throw new HttpError(400, "Image illisible : envoyez une photo JPG ou PNG, ou un PDF.");
        }
    }
    const scan = { id: crypto.randomBytes(12).toString("hex"), kind, name: path.basename(file.originalname || "feuille").slice(0, 80), by: who(access), at: new Date().toISOString() };
    const dest = fileOf(s.id, scan);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, data);
    try {
        await db.runTransaction(async (tx) => {
            const { ref, s: fresh } = await readSession(tx, access, id);
            if ((fresh.scans || []).length >= CONFIG.maxScans) throw new HttpError(400, `Maximum ${CONFIG.maxScans} images par séance.`);
            tx.update(ref, { scans: FieldValue.arrayUnion(scan) });
            tx.create(newAudit(), auditEntry(access, "scan.add", { sessionId: s.id, classId: s.classId, details: { name: scan.name } }));
        });
    } catch (err) {
        await fs.promises.rm(dest, { force: true });
        throw err;
    }
    dropCache(s.classId);
    return { id: scan.id, kind, name: scan.name, by: access.name, at: scan.at };
}

async function scanFile(access, id, scanId) {
    const { s } = await readSession(null, access, id);
    const scan = (s.scans || []).find((x) => x.id === scanId);
    const file = scan && fileOf(s.id, scan);
    if (!file || !fs.existsSync(file)) throw new HttpError(404, "Image introuvable.");
    return { file, type: scan.kind === "pdf" ? "application/pdf" : "image/jpeg" };
}

async function removeScan(access, id, scanId) {
    let file;
    let classId;
    await db.runTransaction(async (tx) => {
        const { ref, s } = await readSession(tx, access, id);
        if (!permissions(access, s).scans) throw new HttpError(403, "Vous ne pouvez pas retirer cette image.");
        const scan = (s.scans || []).find((x) => x.id === scanId);
        if (!scan) throw new HttpError(404, "Image introuvable.");
        tx.update(ref, { scans: s.scans.filter((x) => x.id !== scanId) });
        tx.create(newAudit(), auditEntry(access, "scan.remove", { sessionId: s.id, classId: s.classId, details: { name: scan.name, addedBy: scan.by?.name || "" } }));
        file = fileOf(s.id, scan);
        classId = s.classId;
    });
    await fs.promises.rm(file, { force: true });
    dropCache(classId);
}

module.exports = { addScan, scanFile, removeScan, dirOf };
