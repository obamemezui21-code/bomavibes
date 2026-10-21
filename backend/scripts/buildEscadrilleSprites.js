// Cuts ESCADRILLE OGOUÉ's aircraft out of the sheet generated with Gemini
// (top-down views on a plain magenta background, laid out freely) into one
// picture each: frontend-web/public/escadrille/<name>.webp. The game draws
// them at its own size and falls back to its canvas drawings when one is
// missing (frontend-web/src/game/escadrille/renderer.js).
//
// Usage: node scripts/buildEscadrilleSprites.js <sheet.png>
//
// Each piece is a box on the sheet (found once with a connected-areas pass),
// turned so the player's jets face north and the enemies south. The sheet is
// the 2026-10-21 one: another sheet needs its boxes measured again.
const path = require("path");
const sharp = require("sharp");

const OUT_DIR = path.join(__dirname, "..", "..", "frontend-web", "public", "escadrille");

// [left, top, right, bottom] on the sheet, inclusive.
const PIECES = [
    { name: "jet-aigle", box: [12, 19, 207, 269] },
    { name: "jet-faucon", box: [235, 27, 409, 269] },
    { name: "jet-calao", box: [422, 18, 638, 259] },
    { name: "avion-helice", box: [668, 75, 835, 239], rotate: 180 },
    { name: "helico", box: [849, 14, 1014, 240] },
    { name: "avion-delta", box: [232, 293, 410, 537] },
    // Drawn over the drone's lower rotors: rows above them are left out, and
    // in the overlap only the jet's middle (nacelles and spine) is kept.
    { name: "avion-jet", box: [26, 368, 190, 542], keep: (x, y) => y >= 385 && (y >= 413 || (x >= 84 && x <= 136)) },
    // The drone overlaps that jet: its top half, mirrored, makes the whole of it.
    { name: "drone", box: [26, 290, 190, 353], mirrorDown: true },
    { name: "vedette", box: [477, 315, 652, 365] },
    { name: "tourelle", box: [726, 272, 851, 379] },
    { name: "parachute", box: [891, 284, 991, 415] },
    // The parachutist's legs hang into the boss's box.
    { name: "boss", box: [440, 389, 1014, 550], rotate: 180, keep: (x, y) => !(x >= 922 && x <= 960 && y <= 420) },
];

// Magenta key: how much red AND blue exceed green (as for Commando's sheets).
function keyOut(data, width, height) {
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
        const excess = Math.min(r, b) - g;
        if (excess > 70) {
            data[o + 3] = 0;
        } else if (excess > 25) {
            data[o + 3] = Math.round(((70 - excess) / 45) * 255);
            data[o] = r - excess * 0.8; // remove the pink spill on the edges
            data[o + 2] = b - excess * 0.8;
        } else if (excess > 8) {
            data[o] = r - excess * 0.6;
            data[o + 2] = b - excess * 0.6;
        }
    }
}

async function cut(sheet, piece) {
    const [x0, y0, x1, y1] = piece.box;
    const width = x1 - x0 + 1;
    const height = y1 - y0 + 1;
    const { data } = await sharp(sheet)
        .extract({ left: x0, top: y0, width, height })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    keyOut(data, width, height);
    if (piece.keep) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) if (!piece.keep(x0 + x, y0 + y)) data[(y * width + x) * 4 + 3] = 0;
        }
    }
    let out = data;
    let outHeight = height;
    if (piece.mirrorDown) {
        outHeight = height * 2 - 1;
        out = Buffer.alloc(width * outHeight * 4);
        data.copy(out, 0);
        for (let y = 0; y < height - 1; y++) {
            data.copy(out, (height + y) * width * 4, (height - 2 - y) * width * 4, (height - 1 - y) * width * 4);
        }
    }
    let image = sharp(out, { raw: { width, height: outHeight, channels: 4 } });
    if (piece.rotate) image = sharp(await image.rotate(piece.rotate).png().toBuffer());
    const file = path.join(OUT_DIR, `${piece.name}.webp`);
    const info = await image.trim({ threshold: 0 }).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
    console.log(`${piece.name}.webp  ${info.width}×${info.height}`);
}

async function main() {
    const sheet = process.argv[2];
    if (!sheet) {
        console.error("Usage: node scripts/buildEscadrilleSprites.js <sheet.png>");
        process.exit(1);
    }
    for (const piece of PIECES) await cut(sheet, piece);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
