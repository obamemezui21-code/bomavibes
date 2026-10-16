const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ort = require("onnxruntime-node");

// Photos sent in the chat are never refused: one that looks like nudity is
// only flagged "sensitive", and the receiver sees it blurred until they
// choose to open it (like Bumble's Private Detector). Runs on the VPS,
// nothing is sent outside.
//
// Model: AdamCodd/vit-base-nsfw-detector (Apache-2.0), int8 ONNX,
// downloaded by scripts/fetchModels.js. Labels: 0 = sfw, 1 = nsfw.
//
// Threshold: ordinary clothed photos (portraits, couples, tank tops, dark
// and light skin) scored at most 0.75; a false alarm only costs a tap, but
// blurring ordinary photos would make the blur meaningless.
const MODEL = path.join(__dirname, "..", "..", "models", "nsfw-vit-q8.onnx");
const SIZE = 384;
const SENSITIVE_FROM = 0.85;

let session = null;
function getSession() {
    if (!session) {
        session = ort.InferenceSession.create(MODEL, { logSeverityLevel: 3 }).catch((err) => {
            session = null;
            throw err;
        });
    }
    return session;
}

/**
 * @param {string|Buffer} image - the photo (path or buffer), already EXIF-rotated
 * @returns {Promise<{ sensitive: boolean, score: number | null }>} score null when the model is missing
 */
async function analyzeChatPhoto(image) {
    if (!fs.existsSync(MODEL)) return { sensitive: false, score: null };

    // ViTImageProcessor: plain resize to 384×384, then (x/255 - 0.5) / 0.5.
    const { data } = await sharp(image)
        .resize(SIZE, SIZE, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const plane = SIZE * SIZE;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
        for (let c = 0; c < 3; c++) input[c * plane + i] = data[i * 3 + c] / 127.5 - 1;
    }

    const out = await (await getSession()).run({ pixel_values: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
    const [sfw, nsfw] = out.logits.data;
    const score = 1 / (1 + Math.exp(sfw - nsfw));
    return { sensitive: score >= SENSITIVE_FROM, score: Number(score.toFixed(3)) };
}

module.exports = { analyzeChatPhoto };
