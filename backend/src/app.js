const express = require("express");
const { apiLimiter } = require("./middleware/rateLimits");
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
const adminRoutes = require("./routes/adminRoutes");
const contentRoutes = require("./routes/contentRoutes");
const userDirectoryRoutes = require("./routes/userDirectoryRoutes");
const adminNotificationsRoutes = require("./routes/notificationsRoutes");
const cmsMediaRoutes = require("./routes/cmsMediaRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const eventTicketsRoutes = require("./routes/eventTicketsRoutes");
const aiPartnersRoutes = require("./routes/aiPartnersRoutes");
const callRoutes = require("./routes/callRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { startPaymentSweepScheduler } = require("./controllers/paymentController");
const { startWwfNewsScheduler } = require("./services/wwfNewsService");
const { startCallCleanupScheduler } = require("./services/callCleanupService");

const app = express();

// nginx on the same machine proxies /api here: trust X-Forwarded-For from it
// (and only from it) so req.ip is the visitor's address, not 127.0.0.1.
app.set("trust proxy", "loopback");

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

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
app.use("/api/admin", adminRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/admin/directory", userDirectoryRoutes);
app.use("/api/admin/notifications", adminNotificationsRoutes);
app.use("/api/admin/media", cmsMediaRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/events", eventTicketsRoutes);
app.use("/api/admin/ai-partners", aiPartnersRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/verification", verificationRoutes.userRouter);
app.use("/api/admin/verifications", verificationRoutes.adminRouter);
app.use("/api/swipes", subscriptionRoutes.swipeRouter);
app.use("/api/me", subscriptionRoutes.meRouter);
app.use("/api/admin/subscriptions", subscriptionRoutes.adminRouter);
app.use("/api/payments", paymentRoutes.router);
app.use("/api/admin/payments", paymentRoutes.adminRouter);

startWwfNewsScheduler();
startCallCleanupScheduler();
startPaymentSweepScheduler();

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
});

module.exports = app;