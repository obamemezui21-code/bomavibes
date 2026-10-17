// Turns a character sheet generated with Gemini (poses on a plain magenta
// background, laid out on a grid) into the game's sprite sheet:
//   frontend-web/public/commando/sprites-<name>.webp  (frames side by side)
//   frontend-web/public/commando/sprites-<name>.json  (where each pose is)
//
// Usage:
//   node scripts/buildCommandoSprites.js <name> <image> <cols>x<rows> <poses> [<image> <cols>x<rows> <poses> …]
//   poses: one per cell, left to right then top to bottom, comma-separated:
//          stand | run | jump | up | throw | hurt | kneel | lying, or - to skip
//   Several sheets can be combined (e.g. a pose redone later).
// Example:
//   node scripts/buildCommandoSprites.js mboumba sheet.png 4x2 run,run,run,run,stand,up,throw,hurt
//
// Per frame: the magenta is keyed out (with the pink fringe removed), the
// figure is trimmed, its head gives the anchor (so poses line up), its feet
// sit on the bottom row, and the rifle tip is noted for the muzzle flash.
const path = require("path");
const sharp = require("sharp");

const OUT_DIR = path.join(__dirname, "..", "..", "frontend-web", "public", "commando");
const POSES = ["stand", "run", "jump", "up", "throw", "hurt", "kneel", "lying"];
const GAP = 4; // transparent pixels between frames in the sheet
const INSET = 6; // pixels left out on each side of a cell: Gemini sometimes draws grid lines

// Magenta key: how much red AND blue exceed green.
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

function frameInfo(data, width, height) {
  const opaque = (x, y) => data[(y * width + x) * 4 + 3] > 128;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  // Head: the opaque columns in the top 12% of the figure.
  const headRows = Math.max(4, Math.round((maxY - minY) * 0.12));
  let sum = 0, n = 0;
  for (let y = minY; y < minY + headRows; y++) {
    for (let x = minX; x <= maxX; x++) if (opaque(x, y)) { sum += x; n++; }
  }
  // Rifle tip: the right-most opaque pixel in the upper 70% (forward shots),
  // and the top-most one (shots straight up).
  let tip = { x: minX, y: minY };
  for (let y = minY; y < minY + (maxY - minY) * 0.7; y++) {
    for (let x = maxX; x >= minX; x--) {
      if (opaque(x, y)) {
        if (x > tip.x) tip = { x, y };
        break;
      }
    }
  }
  let top = { x: minX, y: minY };
  for (let x = minX; x <= maxX; x++) if (opaque(x, minY)) { top = { x, y: minY }; break; }
  return { minX, minY, maxX, maxY, headX: n ? sum / n : (minX + maxX) / 2, tip, top };
}

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || rest.length === 0 || rest.length % 3 !== 0) {
    console.error("Usage: node scripts/buildCommandoSprites.js <name> <image> <cols>x<rows> <poses> [...]");
    process.exit(1);
  }
  const frames = [];
  for (let g = 0; g < rest.length; g += 3) {
    const [source, grid, poseList] = rest.slice(g, g + 3);
    if (!/^\d+x\d+$/.test(grid)) throw new Error(`Bad grid: ${grid}`);
    const [cols, rows] = grid.split("x").map(Number);
    const poses = poseList.split(",");
    if (poses.length !== cols * rows || poses.some((p) => p !== "-" && !POSES.includes(p))) {
      throw new Error(`${source}: expected ${cols * rows} poses among ${POSES.join(", ")} or -`);
    }
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cellW = Math.floor(info.width / cols) - INSET * 2;
    const cellH = Math.floor(info.height / rows) - INSET * 2;
    for (let i = 0; i < poses.length; i++) {
      if (poses[i] === "-") continue;
      const cx = (i % cols) * Math.floor(info.width / cols) + INSET;
      const cy = Math.floor(i / cols) * Math.floor(info.height / rows) + INSET;
      const cell = Buffer.alloc(cellW * cellH * 4);
      for (let y = 0; y < cellH; y++) {
        data.copy(cell, y * cellW * 4, ((cy + y) * info.width + cx) * 4, ((cy + y) * info.width + cx + cellW) * 4);
      }
      keyOut(cell, cellW, cellH);
      const f = frameInfo(cell, cellW, cellH);
      if (!f) continue;
      const w = f.maxX - f.minX + 1;
      const h = f.maxY - f.minY + 1;
      const png = await sharp(cell, { raw: { width: cellW, height: cellH, channels: 4 } })
        .extract({ left: f.minX, top: f.minY, width: w, height: h })
        .png()
        .toBuffer();
      frames.push({
        pose: poses[i],
        png,
        w,
        h,
        // Relative to the frame's top-left: anchor (head over the feet line),
        // muzzle for forward and upward shots.
        anchorX: Math.round(f.headX - f.minX),
        muzzle: [f.tip.x - f.minX, f.tip.y - f.minY],
        muzzleUp: [f.top.x - f.minX, 0],
      });
    }
  }

  // Pack side by side, bottoms aligned.
  const sheetH = Math.max(...frames.map((f) => f.h));
  let x = 0;
  const manifest = { name, height: sheetH, frames: {} };
  const composites = [];
  for (const f of frames) {
    composites.push({ input: f.png, left: x, top: sheetH - f.h });
    (manifest.frames[f.pose] ||= []).push({
      x,
      y: sheetH - f.h,
      w: f.w,
      h: f.h,
      anchorX: f.anchorX,
      muzzle: f.muzzle,
      muzzleUp: f.muzzleUp,
    });
    x += f.w + GAP;
  }
  // The standing height the game scales to: the tallest standing / running frame.
  const upright = [...(manifest.frames.stand || []), ...(manifest.frames.run || [])];
  manifest.figureHeight = upright.length ? Math.max(...upright.map((f) => f.h)) : sheetH;

  const sheet = path.join(OUT_DIR, `sprites-${name}.webp`);
  await sharp({ create: { width: x - GAP, height: sheetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(sheet);
  require("fs").writeFileSync(path.join(OUT_DIR, `sprites-${name}.json`), JSON.stringify(manifest, null, 1));
  console.log(`${frames.length} frames → ${sheet}`);
  for (const [pose, list] of Object.entries(manifest.frames)) console.log(`  ${pose}: ${list.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
