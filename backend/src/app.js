const express = require("express");
const cors = require("cors");
const emailActionRoutes = require("./routes/emailActionRoutes");
const photoRoutes = require("./routes/photoRoutes");
const notifyRoutes = require("./routes/notifyRoutes");
const accountRoutes = require("./routes/accountRoutes");
const newsRoutes = require("./routes/newsRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const chatAttachmentRoutes = require("./routes/chatAttachmentRoutes");
const feedPhotoRoutes = require("./routes/feedPhotoRoutes");
const musicRoutes = require("./routes/musicRoutes");
const captchaRoutes = require("./routes/captchaRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contentRoutes = require("./routes/contentRoutes");
const userDirectoryRoutes = require("./routes/userDirectoryRoutes");
const adminNotificationsRoutes = require("./routes/notificationsRoutes");
const cmsMediaRoutes = require("./routes/cmsMediaRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const eventTicketsRoutes = require("./routes/eventTicketsRoutes");
const { startWwfNewsScheduler } = require("./services/wwfNewsService");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Route test
app.get("/", (req, res) => {
    res.json({
        message: "API KANI fonctionne 🚀"
    });
});

app.use("/api/auth", emailActionRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/chat-attachments", chatAttachmentRoutes);
app.use("/api/feed-photos", feedPhotoRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/captcha", captchaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/admin/directory", userDirectoryRoutes);
app.use("/api/admin/notifications", adminNotificationsRoutes);
app.use("/api/admin/media", cmsMediaRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/events", eventTicketsRoutes);

startWwfNewsScheduler();

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
});

module.exports = app;