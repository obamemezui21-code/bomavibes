const express = require("express");
const cors = require("cors");
const emailActionRoutes = require("./routes/emailActionRoutes");
const photoRoutes = require("./routes/photoRoutes");
const notifyRoutes = require("./routes/notifyRoutes");
const accountRoutes = require("./routes/accountRoutes");
const newsRoutes = require("./routes/newsRoutes");
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

startWwfNewsScheduler();

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
});

module.exports = app;