require("dotenv").config({ quiet: true });
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Serveur KANI lancé sur le port ${PORT}`);
});