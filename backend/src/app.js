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
const storyVideoRoutes = require("./routes/storyVideoRoutes");
const stickerRoutes = require("./routes/stickerRoutes");
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
const groupCallRoutes = require("./routes/groupCallRoutes");
const liveRoutes = require("./routes/liveRoutes");
const { startLiveSweep } = require("./controllers/liveController");
const { startPhotoAuditScheduler } = require("./services/profilePhotoAudit");
const { startGroupCallSweep } = require("./controllers/groupCallController");
const verificationRoutes = require("./routes/verificationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const ngoriRoutes = require("./routes/ngoriRoutes");
const ngoriRunRoutes = require("./routes/ngoriRunRoutes");
const motoBomaRoutes = require("./routes/motoBomaRoutes");
const motDuJourRoutes = require("./routes/motDuJourRoutes");
const vibeCheckRoutes = require("./routes/vibeCheckRoutes");
const weMetRoutes = require("./routes/weMetRoutes");
const crushTimeRoutes = require("./routes/crushTimeRoutes");
const commandoRoutes = require("./routes/commandoRoutes");
const pantherRoutes = require("./routes/pantherRoutes");
const escadrilleRoutes = require("./routes/escadrilleRoutes");
const perlesRoutes = require("./routes/perlesRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const locationRoutes = require("./routes/locationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const photoReviewRoutes = require("./routes/photoReviewRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { startPaymentSweepScheduler } = require("./controllers/paymentController");
const { startCallCleanupScheduler } = require("./services/callCleanupService");
const { startStoryCleanupScheduler } = require("./services/storyCleanupService");
const { startNewsScheduler } = require("./services/newsService");
const { startEphemeralSweepScheduler } = require("./services/ephemeralSweepService");
const { markLegacyMembers } = require("./services/identityMigration");

const app = express();

// nginx on the same machine proxies /api here: trust X-Forwarded-For from it
// (and only from it) so req.ip is the visitor's address, not 127.0.0.1.
app.set("trust proxy", "loopback");

// Middlewares
app.use(cors());
// A sortie of Escadrille Ogooué records the jet's course every 2 ticks: up to
// ~120 KB for the longest ones, over the default limit.
app.use("/api/escadrille/finish", express.json({ limit: "300kb" }));
// A long game of Perles Punu (30 min, a throw every 10 ticks) can pass 100 KB.
app.use("/api/perles/finish", express.json({ limit: "300kb" }));
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
app.use("/api/story-videos", storyVideoRoutes);
app.use("/api/feed-videos", storyVideoRoutes.feedVideoRouter);
app.use("/api/stickers", stickerRoutes);
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
app.use("/api/group-calls", groupCallRoutes);
app.use("/api/lives", liveRoutes.router);
app.use("/api/admin/lives", liveRoutes.adminRouter);
app.use("/api/verification", verificationRoutes.userRouter);
app.use("/api/admin/verifications", verificationRoutes.adminRouter);
app.use("/api/swipes", subscriptionRoutes.swipeRouter);
app.use("/api/me", subscriptionRoutes.meRouter);
app.use("/api/admin/subscriptions", subscriptionRoutes.adminRouter);
app.use("/api/ngori", ngoriRoutes);
app.use("/api/ngori-run", ngoriRunRoutes);
app.use("/api/moto-boma", motoBomaRoutes);
app.use("/api/mot-du-jour", motDuJourRoutes);
app.use("/api/vibe-check", vibeCheckRoutes);
app.use("/api/we-met", weMetRoutes);
app.use("/api/crush-time", crushTimeRoutes);
app.use("/api/commando", commandoRoutes);
app.use("/api/panthere", pantherRoutes);
app.use("/api/escadrille", escadrilleRoutes);
app.use("/api/perles", perlesRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin/photo-reviews", photoReviewRoutes);
app.use("/api/payments", paymentRoutes.router);
app.use("/api/admin/payments", paymentRoutes.adminRouter);

startCallCleanupScheduler();
startStoryCleanupScheduler();
startEphemeralSweepScheduler();
markLegacyMembers();
startGroupCallSweep();
startLiveSweep();
startPhotoAuditScheduler();
startPaymentSweepScheduler();
startNewsScheduler();

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
});

module.exports = app;