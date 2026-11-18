const path = require("node:path");
const os = require("node:os");
const { Worker } = require("node:worker_threads");
const { CONFIG } = require("../config");
const { paragraphs, wordCount } = require("../text");

// B. Estimation par modèle de langage — Binoculars (binocularsWorker.js) on
// two small open models, run on this server: the text is not sent anywhere.
//
// OFF unless EDU_CHECK_ML_ENGINE=binoculars: the two models need ~1.5 GB of
// memory while they work. Check the server first (README.md, "Moteur ML").
// They load on the first analysis and are unloaded after some idle time.
//
// What it measures: how predictable the text is to a language model. It is
// not trained on ChatGPT, Claude or Gemini and cannot say which one was used;
// it tells nothing about who wrote the text, only how it reads to a model.

const num = (name, fallback) => {
    const v = Number.parseFloat(process.env[name] ?? "");
    return Number.isFinite(v) ? v : fallback;
};

function settings() {
    return {
        engine: (process.env.EDU_CHECK_ML_ENGINE || "off").trim().toLowerCase(),
        observer: process.env.EDU_CHECK_ML_OBSERVER || "onnx-community/Qwen2.5-0.5B",
        performer: process.env.EDU_CHECK_ML_PERFORMER || "onnx-community/Qwen2.5-0.5B-Instruct",
        dtype: process.env.EDU_CHECK_ML_DTYPE || "q8",
        threads: Math.max(1, Math.min(8, Math.round(num("EDU_CHECK_ML_THREADS", 2)))),
        maxTokens: Math.max(64, Math.min(1024, Math.round(num("EDU_CHECK_ML_MAX_TOKENS", 320)))),
        maxWindows: Math.max(1, Math.min(12, Math.round(num("EDU_CHECK_ML_MAX_WINDOWS", 4)))),
        cacheDir: process.env.EDU_CHECK_ML_CACHE_DIR || path.join(os.homedir(), ".cache", "bomavibes-models"),
        // Below `high`: élevée; below `moderate`: modérée. Calibrated on French
        // texts (README.md, "Moteur ML"): change them only after measuring.
        high: num("EDU_CHECK_ML_HIGH", 0.8),
        moderate: num("EDU_CHECK_ML_MODERATE", 0.88),
        idleMs: num("EDU_CHECK_ML_IDLE_MINUTES", 10) * 60000,
        timeoutMs: num("EDU_CHECK_ML_TIMEOUT_SECONDS", 240) * 1000,
    };
}

const ENGINE_NAME = "Binoculars · Qwen2.5-0.5B (base et instruct), sur le serveur";

function modelStatus() {
    const s = settings();
    const enabled = s.engine === "binoculars";
    return { enabled, name: enabled ? ENGINE_NAME : null, note: enabled ? null : "Moteur ML non activé sur ce serveur." };
}

// One worker, one job at a time; dropped when idle to give the memory back.
let worker = null;
let idleTimer = null;
let queue = Promise.resolve();
let nextId = 1;

function getWorker(s) {
    if (worker) return worker;
    worker = new Worker(path.join(__dirname, "binocularsWorker.js"), {
        workerData: { observer: s.observer, performer: s.performer, dtype: s.dtype, threads: s.threads, maxTokens: s.maxTokens, cacheDir: s.cacheDir },
        resourceLimits: { maxOldGenerationSizeMb: 1024 },
    });
    worker.unref();
    worker.on("error", (err) => {
        console.error("EDU-CHECK ML worker:", err.message);
        worker = null;
    });
    worker.on("exit", () => {
        worker = null;
    });
    return worker;
}

function scoreTexts(texts, s) {
    const job = queue.then(
        () =>
            new Promise((resolve, reject) => {
                clearTimeout(idleTimer);
                const w = getWorker(s);
                const id = nextId++;
                const timer = setTimeout(() => {
                    w.off("message", onMessage);
                    w.terminate();
                    reject(new Error("timeout"));
                }, s.timeoutMs);
                function onMessage(msg) {
                    if (msg.id !== id) return;
                    clearTimeout(timer);
                    w.off("message", onMessage);
                    msg.ok ? resolve(msg.out) : reject(new Error(msg.error));
                }
                w.on("message", onMessage);
                w.postMessage({ id, texts });
            }),
    );
    queue = job
        .catch(() => {})
        .then(() => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => worker?.terminate(), s.idleMs);
            idleTimer.unref?.();
        });
    return job;
}

// The text in pieces of about 180–260 words, on paragraph boundaries, so a
// passage can be pointed at. At most `max`, spread over the text.
function windowsOf(text, max) {
    const out = [];
    let cur = [];
    let n = 0;
    for (const p of paragraphs(text)) {
        const w = wordCount(p);
        if (n && n + w > 260) {
            out.push(cur.join("\n\n"));
            cur = [];
            n = 0;
        }
        cur.push(p);
        n += w;
        if (n >= 180) {
            out.push(cur.join("\n\n"));
            cur = [];
            n = 0;
        }
    }
    if (cur.length) {
        if (n < 80 && out.length) out[out.length - 1] += `\n\n${cur.join("\n\n")}`;
        else out.push(cur.join("\n\n"));
    }
    if (out.length <= max) return out.map((t, i) => ({ index: i, text: t }));
    const step = (out.length - 1) / (max - 1 || 1);
    return Array.from({ length: max }, (_, k) => Math.round(k * step)).map((i) => ({ index: i, text: out[i] }));
}

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const BANDS = { faible: "Indication faible", moderee: "Indication modérée", elevee: "Indication élevée" };

const LIMITATIONS = [
    "Mesure à quel point le texte est prévisible pour un modèle de langage. Un texte très scolaire, encyclopédique ou appris par cœur peut paraître « prévisible » sans IA ; un texte d’IA reformulé à la main ou par un outil de « réécriture » peut ne pas l’être.",
    "Le moteur ne reconnaît pas le fournisseur (ChatGPT, Claude, Gemini, DeepSeek…) : il n’a été entraîné sur aucun d’eux.",
    "Calibré sur un petit échantillon de textes français (voir README) : c’est une estimation, pas une probabilité, et jamais une preuve.",
];

/**
 * @param {{ text: string, lang: string|null }} input — the written prose
 * @param {{ detector?: (texts: string[]) => Promise<{ score: number, tokens: number }[]> }} [deps]
 */
async function estimateWithModel({ text, lang }, { detector } = {}) {
    const s = settings();
    const startedAt = new Date().toISOString();
    if (!detector && s.engine !== "binoculars") {
        return { status: "unavailable", reason: "Le moteur d’estimation par modèle de langage n’est pas activé sur ce serveur.", engine: null, limitations: [] };
    }
    const words = wordCount(text);
    if (words < CONFIG.minWords) return { status: "inconclusive", reason: `Texte trop court (${words} mots rédigés ; il en faut au moins ${CONFIG.minWords}).`, engine: ENGINE_NAME, limitations: [] };
    if (lang !== "fr") return { status: "inconclusive", reason: "Ce moteur n’est calibré que pour le français.", engine: ENGINE_NAME, limitations: [] };

    const windows = windowsOf(text, s.maxWindows);
    let scores;
    try {
        scores = detector ? await detector(windows.map((w) => w.text)) : await scoreTexts(windows.map((w) => w.text), s);
    } catch (err) {
        console.error("EDU-CHECK ML:", err.message);
        const reason =
            err.message === "timeout"
                ? "Le moteur a mis trop de temps à répondre : estimation abandonnée pour ce devoir."
                : /Cannot find (?:package|module)/i.test(err.message)
                  ? "Le moteur est activé mais pas installé sur ce serveur (paquet @huggingface/transformers absent)."
                  : "Le moteur n’a pas pu analyser ce texte.";
        return { status: "unavailable", reason, engine: ENGINE_NAME, limitations: [] };
    }
    const bandOf = (x) => (x < s.high ? "elevee" : x < s.moderate ? "moderee" : "faible");
    const overall = median(scores.map((x) => x.score));
    const band = bandOf(overall);
    const passages = windows
        .map((w, i) => ({ index: w.index, score: Math.round(scores[i].score * 1000) / 1000, band: bandOf(scores[i].score), words: wordCount(w.text), preview: w.text.replace(/\s+/g, " ").slice(0, 280) }))
        .sort((a, b) => a.index - b.index);
    const flagged = passages.filter((p) => p.band !== "faible");
    const limitations = [...LIMITATIONS];
    if (windows.length < Math.ceil(words / 260)) limitations.push(`Seuls ${windows.length} passages, répartis dans le devoir, ont été lus par le modèle.`);
    return {
        status: "ok",
        band,
        label: BANDS[band],
        score: Math.round(overall * 1000) / 1000,
        thresholds: { high: s.high, moderate: s.moderate },
        passages,
        observations: flagged.length
            ? [`${flagged.length} passage${flagged.length > 1 ? "s" : ""} sur ${passages.length} ${flagged.length > 1 ? "sont" : "est"} aussi prévisible${flagged.length > 1 ? "s" : ""} qu’un texte produit par un modèle.`]
            : ["Aucun passage n’est aussi prévisible qu’un texte produit par un modèle."],
        engine: ENGINE_NAME,
        checkedAt: startedAt,
        limitations,
    };
}

module.exports = { estimateWithModel, modelStatus, windowsOf };
