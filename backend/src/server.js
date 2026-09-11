require("dotenv").config({ quiet: true });
const app = require("./app");

const PORT = process.env.PORT || 5000;

// Safety net for errors that don't flow through Express's own request
// handling (e.g. a gRPC/stream-level error emitted internally by the
// Firestore Admin SDK while retrying under RESOURCE_EXHAUSTED, outside the
// promise Express is awaiting for the current request). Without this,
// Node's default behavior is to terminate the process on both event types,
// which is what was turning transient Firestore quota errors into a PM2
// crash-restart loop. Every route already catches its own Firestore calls;
// this only guards the cases application code structurally cannot reach.
process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
});

app.listen(PORT, () => {
    console.log(`Serveur KANI lancé sur le port ${PORT}`);
});