// Runs in a worker thread (see detector.js): the models' work never blocks
// the server that answers the app.
//
// Binoculars (Hans et al., 2024, arXiv:2401.12070): two language models of
// the same family read the text. The score is the text's perplexity (how
// surprising each next word is) divided by the cross-perplexity (how
// surprising one model's predictions are to the other). Machine text sits
// low: it is as predictable as a model's own output. Zero-shot: nothing was
// trained on a given chatbot, so it is not tied to one, nor can it say which.
const { parentPort, workerData } = require("node:worker_threads");

let ready = null;

async function load() {
    const { AutoTokenizer, AutoModelForCausalLM, env } = await import("@huggingface/transformers");
    if (workerData.cacheDir) env.cacheDir = workerData.cacheDir;
    // Only the models named in the settings, downloaded once into cacheDir.
    env.allowRemoteModels = workerData.allowDownload !== false;
    const session = { session_options: { intraOpNumThreads: workerData.threads, interOpNumThreads: 1 } };
    const tokenizer = await AutoTokenizer.from_pretrained(workerData.observer);
    const observer = await AutoModelForCausalLM.from_pretrained(workerData.observer, { dtype: workerData.dtype, ...session });
    const performer = await AutoModelForCausalLM.from_pretrained(workerData.performer, { dtype: workerData.dtype, ...session });
    return { tokenizer, observer, performer };
}

function logSumExp(data, off, V) {
    let m = -Infinity;
    for (let i = 0; i < V; i++) if (data[off + i] > m) m = data[off + i];
    let s = 0;
    for (let i = 0; i < V; i++) s += Math.exp(data[off + i] - m);
    return m + Math.log(s);
}

async function score(text) {
    const { tokenizer, observer, performer } = await ready;
    const enc = tokenizer(text, { truncation: true, max_length: workerData.maxTokens });
    const inputs = { input_ids: enc.input_ids, attention_mask: enc.attention_mask };
    const lo = (await observer(inputs)).logits;
    const lp = (await performer(inputs)).logits;
    const [, T, V] = lo.dims;
    const ids = Array.from(enc.input_ids.data, Number);
    let ppl = 0;
    let xppl = 0;
    for (let t = 0; t < T - 1; t++) {
        const off = t * V;
        const zP = logSumExp(lp.data, off, V);
        const zO = logSumExp(lo.data, off, V);
        ppl += zP - lp.data[off + ids[t + 1]];
        let x = 0;
        for (let v = 0; v < V; v++) x += Math.exp(lo.data[off + v] - zO) * (zP - lp.data[off + v]);
        xppl += x;
    }
    lo.dispose?.();
    lp.dispose?.();
    return { score: ppl / xppl, tokens: T };
}

parentPort.on("message", async ({ id, texts }) => {
    try {
        ready ??= load();
        const out = [];
        for (const t of texts) out.push(await score(t));
        parentPort.postMessage({ id, ok: true, out });
    } catch (err) {
        ready = null;
        parentPort.postMessage({ id, ok: false, error: String(err?.message || err).slice(0, 300) });
    }
});
