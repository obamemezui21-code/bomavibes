const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

async function uploadPhoto(req, res) {
  const uid = req.firebaseUser.uid;
  const slot = Number(req.body.slot);

  if (![0, 1, 2].includes(slot)) {
    return res.status(400).json({ message: "Slot invalide" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "Aucun fichier reçu" });
  }

  try {
    const dir = path.join(UPLOAD_ROOT, uid);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, `photo-${slot}.jpg`);
    fs.renameSync(req.file.path, destPath);

    const url = `${FRONTEND_URL}/uploads/profile-photos/${uid}/photo-${slot}.jpg?v=${Date.now()}`;
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible d'enregistrer la photo" });
  }
}

module.exports = { uploadPhoto };
