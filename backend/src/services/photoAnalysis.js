const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ort = require("onnxruntime-node");
const { THRESHOLDS, decidePhoto, PHOTO_REASONS } = require("./photoDecision");

// Profile photos must show the member, a real person: every photo is
// analysed on upload, on the server, before it's stored. Nothing leaves the
// VPS. Two models:
//
// 1. Face detection — Ultra-Light-Fast-Generic-Face-Detector-1MB, RFB-320
//    (MIT, github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB),
//    in git. A landscape, an object or a person seen from behind gives no
//    face. On its own it also fires on dogs, cats, drawings and masks, hence:
// 2. A veto — CLIP ViT-B/32 (MIT, OpenAI; int8 ONNX by Xenova), downloaded by
//    scripts/fetchModels.js. The photo is compared with short descriptions
//    (models/clip-prompts.json, embeddings computed once); it's refused only
//    when it's clearly an animal, a drawing, or a statue / mask / doll.
//    "Painting" is never a reason to refuse: CLIP calls many real studio
//    portraits — of dark-skinned women especially — paintings.
//
// Then: how big, sharp and lit the face is. What all of this means for the
// photo — accepted, accepted pending a human look, or refused — is decided in
// services/photoDecision.js: only what is certain is refused.
//
// The detector and CLIP vetoes were first tuned on a test set of real photos
// (studio portraits, selfies, groups, dark and light skin) and of what must
// be refused (dogs, cats, a chimpanzee, cartoons, anime, masks, statues,
// drawings); in October 2026 real photos (mirror selfies, gym photos, a phone
// in front of the face) were still refused, hence the softer decision.

const MODELS_DIR = path.join(__dirname, "..", "..", "models");
const FACE_MODEL = path.join(MODELS_DIR, "face-detector-rfb320.onnx");
const CLIP_MODEL = path.join(MODELS_DIR, "clip-vision-q8.onnx");
const CLIP_PROMPTS = path.join(MODELS_DIR, "clip-prompts.json");

const FACE_W = 320;
const FACE_H = 240;
// Faces kept from the detector: from "maybe" up (photoDecision.js decides).
const FACE_SCORE = THRESHOLDS.faceTrace;
const NMS_IOU = 0.3;
// CLIP probabilities are summed over a group's descriptions. On real photos
// of people the groups stayed at or under 0.37 (animal), 0.05 (drawing) and
// 0.58 (object) — the thresholds are in photoDecision.js.
const CLIP_SIZE = 224;
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

const sessions = {};
function getSession(file) {
  if (!sessions[file]) {
    sessions[file] = ort.InferenceSession.create(file, { logSeverityLevel: 3 }).catch((err) => {
      delete sessions[file];
      throw err;
    });
  }
  return sessions[file];
}

let clipPrompts = null;
function getClipPrompts() {
  if (!clipPrompts) clipPrompts = JSON.parse(fs.readFileSync(CLIP_PROMPTS, "utf8"));
  return clipPrompts;
}

function iou(a, b) {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = w * h;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

function nms(boxes) {
  const kept = [];
  for (const box of boxes.sort((a, b) => b.score - a.score)) {
    if (kept.every((k) => iou(k, box) < NMS_IOU)) kept.push(box);
  }
  return kept;
}

// Faces in pixel coordinates of an image of size width × height. The photo
// is letterboxed into the model's 320×240 input so faces aren't squashed.
async function detectFaces(image, width, height) {
  const scale = Math.min(FACE_W / width, FACE_H / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const left = Math.floor((FACE_W - w) / 2);
  const top = Math.floor((FACE_H - h) / 2);

  const { data } = await sharp(image)
    .resize(w, h, { fit: "fill" })
    .extend({ left, top, right: FACE_W - w - left, bottom: FACE_H - h - top, background: "#000" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = FACE_W * FACE_H;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (data[i * 3] - 127) / 128;
    input[plane + i] = (data[i * 3 + 1] - 127) / 128;
    input[2 * plane + i] = (data[i * 3 + 2] - 127) / 128;
  }

  const session = await getSession(FACE_MODEL);
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, FACE_H, FACE_W]) });
  const scores = out[session.outputNames[0]].data;
  const coords = out[session.outputNames[1]].data;

  // Normalized to the 320×240 input → back to the photo.
  const toX = (v) => Math.min(width, Math.max(0, (v * FACE_W - left) / scale));
  const toY = (v) => Math.min(height, Math.max(0, (v * FACE_H - top) / scale));
  const found = [];
  for (let i = 0; i < scores.length / 2; i++) {
    const score = scores[i * 2 + 1];
    if (score < FACE_SCORE) continue;
    found.push({
      score,
      x1: toX(coords[i * 4]),
      y1: toY(coords[i * 4 + 1]),
      x2: toX(coords[i * 4 + 2]),
      y2: toY(coords[i * 4 + 3]),
    });
  }
  return nms(found).filter((f) => f.x2 - f.x1 > 2 && f.y2 - f.y1 > 2);
}

// → { person, animal, drawing, painting, object } probabilities, or null
// when the CLIP model isn't there (download failed): the veto is skipped.
async function classify(image) {
  if (!fs.existsSync(CLIP_MODEL)) return null;
  const { logitScale, prompts } = getClipPrompts();

  // Shortest side to 224, centre crop, CLIP normalization.
  const { data } = await sharp(image)
    .resize(CLIP_SIZE, CLIP_SIZE, { fit: "cover", kernel: "cubic" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = CLIP_SIZE * CLIP_SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = (data[i * 3 + c] / 255 - CLIP_MEAN[c]) / CLIP_STD[c];
  }

  const session = await getSession(CLIP_MODEL);
  const out = await session.run({ pixel_values: new ort.Tensor("float32", input, [1, 3, CLIP_SIZE, CLIP_SIZE]) });
  const embeds = out.image_embeds.data;
  const norm = Math.hypot(...embeds);

  const logits = prompts.map((p) => logitScale * p.embedding.reduce((sum, v, i) => sum + v * embeds[i], 0) / norm);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const groups = {};
  prompts.forEach((p, i) => {
    groups[p.group] = (groups[p.group] || 0) + exps[i] / total;
  });
  return groups;
}

// Laplacian spread over a region, measured at a fixed size so the number
// doesn't depend on the photo's resolution.
async function sharpness(image, region) {
  const { data } = await sharp(image)
    .extract(region)
    .greyscale()
    .resize(160, 160, { fit: "fill" })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSq = 0;
  for (const v of data) {
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / data.length;
  return Math.sqrt(Math.max(0, sumSq / data.length - mean * mean));
}

async function brightness(image) {
  const { channels } = await sharp(image).greyscale().stats();
  return channels[0].mean;
}

const round = (v, digits = 2) => Number(v.toFixed(digits));

/**
 * @param {Buffer} image - the photo, already EXIF-rotated
 * @returns {Promise<{ ok: boolean, verdict: 'accepted'|'review'|'rejected', code: string|null, faces: number, details: object }>}
 *   ok: false only when refused; details: every measure, for the decision log
 */
async function analyzeProfilePhoto(image) {
  const { width, height } = await sharp(image).metadata();
  const [faces, light, kinds] = await Promise.all([
    detectFaces(image, width, height),
    brightness(image),
    classify(image),
  ]);
  const details = { faces: faces.length, brightness: Math.round(light), faceScore: 0 };
  if (kinds) details.kinds = Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, round(v)]));

  if (faces.length) {
    // The surest face (a hand or a phone can make a bigger, vaguer box).
    const main = faces.reduce((a, b) => (b.score > a.score ? b : a));
    details.faceScore = round(main.score);
    details.faceShare = round((main.y2 - main.y1) / height, 3);
    details.sharpness = round(
      await sharpness(image, {
        left: Math.floor(main.x1),
        top: Math.floor(main.y1),
        width: Math.max(1, Math.floor(main.x2 - main.x1)),
        height: Math.max(1, Math.floor(main.y2 - main.y1)),
      }),
    );
  }

  const { verdict, code } = decidePhoto({ ...details, kinds: kinds || null });
  return { ok: verdict !== "rejected", verdict, code, faces: faces.length, details };
}

// One precise reason (and a tip) per code — services/photoDecision.js.
const REJECTION_MESSAGES = PHOTO_REASONS;

module.exports = { analyzeProfilePhoto, REJECTION_MESSAGES, THRESHOLDS };
