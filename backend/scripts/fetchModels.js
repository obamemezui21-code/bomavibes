// Downloads the models too big for git into backend/models/ (run by
// `npm install` through postinstall, so deploy.sh fetches them). Skips a
// model already there with the right checksum. Never fails the install: if
// the download fails, photo analysis runs without that model (see
// src/services/photoAnalysis.js) and the next install tries again.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MODELS_DIR = path.join(__dirname, "..", "models");

const MODELS = [
  {
    // CLIP ViT-B/32 image encoder, int8 (MIT licence, via Xenova on Hugging Face).
    file: "clip-vision-q8.onnx",
    url: "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/d15189d7028b43f1d3e65039190477f6af591c2a/onnx/vision_model_quantized.onnx",
    sha256: "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299",
  },
];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function fetchModel({ file, url, sha256: expected }) {
  const dest = path.join(MODELS_DIR, file);
  if (fs.existsSync(dest) && sha256(dest) === expected) return console.log(`✓ ${file}`);

  console.log(`⬇ ${file}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const got = crypto.createHash("sha256").update(data).digest("hex");
  if (got !== expected) throw new Error(`${file}: checksum mismatch`);
  const tmp = `${dest}.download`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, dest);
  console.log(`✓ ${file}`);
}

(async () => {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  for (const model of MODELS) {
    try {
      await fetchModel(model);
    } catch (err) {
      console.warn(`⚠️  Modèle ${model.file} non téléchargé : ${err.message}`);
    }
  }
})();
