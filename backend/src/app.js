const express = require("express");
const cors = require("cors");
const emailActionRoutes = require("./routes/emailActionRoutes");
const photoRoutes = require("./routes/photoRoutes");

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

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
});

module.exports = app;