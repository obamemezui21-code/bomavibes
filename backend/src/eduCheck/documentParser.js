const { CONFIG } = require("./config");
const { normalizeText, wordCount } = require("./text");

// Reads the text of an uploaded homework: PDF, DOCX or TXT. The file's
// content decides, not its name or the type the browser claims: a PDF must
// start with %PDF-, a DOCX must be a ZIP holding word/document.xml, a TXT
// must be text. The file itself is never written to disk nor kept: only the
// text goes on (memory upload, see routes.js).

class ParseError extends Error {
    constructor(message) {
        super(message);
        this.status = 400;
    }
}

const EXTENSIONS = { pdf: "pdf", docx: "docx", txt: "txt" };

function kindOf(buffer, name) {
    const ext = String(name || "").toLowerCase().split(".").pop();
    if (!EXTENSIONS[ext]) throw new ParseError("Format non pris en charge : importez un fichier PDF, DOCX ou TXT.");
    const head = buffer.subarray(0, 5).toString("latin1");
    if (ext === "pdf" && !head.startsWith("%PDF-")) throw new ParseError("Ce fichier n’est pas un vrai PDF.");
    if (ext === "docx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
        throw new ParseError("Ce fichier n’est pas un vrai document Word (.docx).");
    }
    if (ext === "txt" && buffer.includes(0)) throw new ParseError("Ce fichier texte contient des données binaires.");
    return ext;
}

async function pdfText(buffer) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    let pdf;
    try {
        pdf = await getDocumentProxy(new Uint8Array(buffer), { isEvalSupported: false, disableFontFace: true });
    } catch {
        throw new ParseError("Impossible de lire ce PDF (fichier abîmé ou protégé par un mot de passe).");
    }
    try {
        const { text } = await extractText(pdf, { mergePages: false });
        // A page per paragraph break, so pages don't run into each other.
        return (Array.isArray(text) ? text : [text]).join("\n\n");
    } finally {
        await pdf.destroy?.().catch(() => {});
    }
}

// A DOCX is a ZIP: a small file could unpack into gigabytes. Refused past this.
const MAX_DOCX_UNPACKED = 60 * 1024 * 1024;

async function checkDocxSize(buffer) {
    // jszip comes with mammoth.
    const JSZip = require("jszip");
    let zip;
    try {
        zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
    } catch {
        throw new ParseError("Ce fichier n’est pas un vrai document Word (.docx).");
    }
    if (!zip.file("word/document.xml")) throw new ParseError("Ce fichier n’est pas un vrai document Word (.docx).");
    let total = 0;
    zip.forEach((_, entry) => {
        total += entry._data?.uncompressedSize || 0;
    });
    if (total > MAX_DOCX_UNPACKED) throw new ParseError("Document Word trop volumineux une fois décompressé.");
}

async function docxText(buffer) {
    const mammoth = require("mammoth");
    await checkDocxSize(buffer);
    try {
        // Plain text only: no HTML, no images, no external links followed.
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
    } catch {
        throw new ParseError("Impossible de lire ce document Word (fichier abîmé, ou ancien format .doc).");
    }
}

function txtText(buffer) {
    const text = buffer.toString("utf8");
    // Not UTF-8 (many U+FFFD): read it as Windows-1252, as old Notepad files are.
    if ((text.match(/�/g) || []).length > 5) return buffer.toString("latin1");
    return text;
}

/**
 * @param {{ buffer: Buffer, originalname: string, size?: number }} file
 * @returns {Promise<{ text: string, words: number, kind: string }>}
 */
async function parseDocument(file) {
    if (!file?.buffer?.length) throw new ParseError("Fichier vide.");
    if (file.buffer.length > CONFIG.maxFileBytes) {
        throw new ParseError(`Fichier trop lourd (maximum ${Math.round(CONFIG.maxFileBytes / 1024 / 1024)} Mo).`);
    }
    const kind = kindOf(file.buffer, file.originalname);
    const raw = kind === "pdf" ? await pdfText(file.buffer) : kind === "docx" ? await docxText(file.buffer) : txtText(file.buffer);
    const text = normalizeText(raw);
    const words = wordCount(text);
    if (!words) {
        throw new ParseError(
            kind === "pdf"
                ? "Aucun texte trouvé dans ce PDF : c’est peut-être un document scanné (image). Collez le texte à la place."
                : "Aucun texte trouvé dans ce fichier.",
        );
    }
    return { text, words, kind };
}

module.exports = { parseDocument, ParseError };
