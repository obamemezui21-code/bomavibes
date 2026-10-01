const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "stories");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";

// Kept as uploaded (no transcoding on this server): the app limits length
// and size before sending, multer limits size and type here.
const VIDEO_EXTENSIONS = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
};

// POST /api/story-videos (multipart: video, optional poster image)
// → { videoUrl, posterUrl } — the story itself is then written by the app.
async function uploadStoryVideo(req, res) {
    const uid = req.firebaseUser.uid;
    const video = req.files?.video?.[0];
    const poster = req.files?.poster?.[0];
    const cleanup = () => [video, poster].forEach((f) => f && fs.unlink(f.path, () => {}));

    if (!video) {
        cleanup();
        return res.status(400).json({ message: "Aucune vidéo reçue" });
    }

    try {
        const dir = path.join(UPLOAD_ROOT, uid);
        fs.mkdirSync(dir, { recursive: true });
        const timestamp = Date.now();

        const videoName = `video-${timestamp}.${VIDEO_EXTENSIONS[video.mimetype]}`;
        await fs.promises.copyFile(video.path, path.join(dir, videoName));

        let posterUrl = null;
        if (poster) {
            const posterName = `video-${timestamp}-poster.jpg`;
            await sharp(poster.path)
                .rotate()
                .resize({ width: 720, withoutEnlargement: true })
                .jpeg({ quality: 78, mozjpeg: true })
                .toFile(path.join(dir, posterName));
            posterUrl = `${FRONTEND_URL}/uploads/stories/${uid}/${posterName}`;
        }

        cleanup();
        res.json({ videoUrl: `${FRONTEND_URL}/uploads/stories/${uid}/${videoName}`, posterUrl });
    } catch (err) {
        cleanup();
        console.error(err);
        res.status(500).json({ message: "Impossible d'envoyer la vidéo" });
    }
}

module.exports = { uploadStoryVideo, VIDEO_EXTENSIONS };
