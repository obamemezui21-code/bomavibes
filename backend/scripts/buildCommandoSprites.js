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

// "auto" layout: the figures' boxes, found as connected opaque areas once the
// magenta is gone. Small separate bits (KO stars, a rifle tip) join the
// nearest figure. Sorted row by row (rows split at mid-height), left to right.
function findFigures(data, width, height) {
  const S = 4; // work on a 4× smaller mask
  const mw = Math.ceil(width / S);
  const mh = Math.ceil(height / S);
  const mask = new Uint8Array(mw * mh);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 128) mask[Math.floor(y / S) * mw + Math.floor(x / S)] = 1;
  }
  const label = new Int32Array(mw * mh).fill(-1);
  const boxes = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const box = { minX: mw, minY: mh, maxX: 0, maxY: 0, area: 0, ids: new Set([boxes.length]) };
    const stack = [i];
    label[i] = boxes.length;
    while (stack.length) {
      const j = stack.pop();
      const x = j % mw;
      const y = Math.floor(j / mw);
      box.area++;
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
          const k = ny * mw + nx;
          if (mask[k] && label[k] < 0) {
            label[k] = boxes.length;
            stack.push(k);
          }
        }
      }
    }
    boxes.push(box);
  }
  const big = boxes.filter((b) => b.area > 150);
  for (const small of boxes.filter((b) => b.area <= 150)) {
    const cx = (small.minX + small.maxX) / 2;
    const cy = (small.minY + small.maxY) / 2;
    let best = null;
    let dist = Infinity;
    for (const b of big) {
      const d = Math.hypot(Math.max(b.minX - cx, 0, cx - b.maxX), Math.max(b.minY - cy, 0, cy - b.maxY));
      if (d < dist) {
        dist = d;
        best = b;
      }
    }
    if (best && dist < 25) {
      best.minX = Math.min(best.minX, small.minX);
      best.maxX = Math.max(best.maxX, small.maxX);
      best.minY = Math.min(best.minY, small.minY);
      best.maxY = Math.max(best.maxY, small.maxY);
      best.ids.add(boxes.indexOf(small));
    }
  }
  const figures = big
    .map((b) => {
      const x = b.minX * S;
      const y = b.minY * S;
      const w = Math.min((b.maxX - b.minX + 1) * S, width - x);
      const h = Math.min((b.maxY - b.minY + 1) * S, height - y);
      return { x, y, w, h, ids: b.ids, row: y + h / 2 < height / 2 ? 0 : 1 };
    })
    .sort((a, b) => a.row - b.row || a.x - b.x);
  // Whether a pixel belongs to a given figure (and not to an overlapping neighbour).
  const belongs = (figure, gx, gy) => {
    const lab = label[Math.floor(gy / S) * mw + Math.floor(gx / S)];
    return lab < 0 || figure.ids.has(lab);
  };
  return { figures, belongs };
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
    const poses = poseList.split(",");
    // "4x2@0.6" / "auto@0.6": scale this sheet's figures (Gemini's sheets
    // don't all draw the character at the same size).
    const [layout, scaleText] = grid.split("@");
    const scale = scaleText ? Number(scaleText) : 1;
    if (!(scale > 0 && scale <= 4)) throw new Error(`Bad scale: ${grid}`);
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let cells;
    let belongs = null;
    if (layout === "auto") {
      const keyed = Buffer.from(data);
      keyOut(keyed, info.width, info.height);
      const found = findFigures(keyed, info.width, info.height);
      belongs = found.belongs;
      cells = found.figures.map((b) => {
        const x = Math.max(0, b.x - 4);
        const y = Math.max(0, b.y - 4);
        return { x, y, w: Math.min(info.width - x, b.w + 8), h: Math.min(info.height - y, b.h + 8), figure: b };
      });
      console.log(`${source}: ${cells.length} figures found`);
    } else {
      const grid = layout;
      if (!/^\d+x\d+$/.test(grid)) throw new Error(`Bad grid: ${grid}`);
      const [cols, rows] = grid.split("x").map(Number);
      const cw = Math.floor(info.width / cols);
      const ch = Math.floor(info.height / rows);
      cells = Array.from({ length: cols * rows }, (_, i) => ({
        x: (i % cols) * cw + INSET,
        y: Math.floor(i / cols) * ch + INSET,
        w: cw - INSET * 2,
        h: ch - INSET * 2,
      }));
    }
    if (poses.length !== cells.length || poses.some((p) => p !== "-" && !POSES.includes(p))) {
      throw new Error(`${source}: expected ${cells.length} poses among ${POSES.join(", ")} or -`);
    }
    for (let i = 0; i < poses.length; i++) {
      if (poses[i] === "-") continue;
      const { x: cx, y: cy, w: cellW, h: cellH } = cells[i];
      const cell = Buffer.alloc(cellW * cellH * 4);
      for (let y = 0; y < cellH; y++) {
        data.copy(cell, y * cellW * 4, ((cy + y) * info.width + cx) * 4, ((cy + y) * info.width + cx + cellW) * 4);
      }
      keyOut(cell, cellW, cellH);
      // Auto layout: drop the bits of overlapping neighbours.
      if (belongs) {
        for (let y = 0; y < cellH; y++) {
          for (let x = 0; x < cellW; x++) {
            if (!belongs(cells[i].figure, cx + x, cy + y)) cell[(y * cellW + x) * 4 + 3] = 0;
          }
        }
      }
      const f = frameInfo(cell, cellW, cellH);
      if (!f) continue;
      const w0 = f.maxX - f.minX + 1;
      const h0 = f.maxY - f.minY + 1;
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      const png = await sharp(cell, { raw: { width: cellW, height: cellH, channels: 4 } })
        .extract({ left: f.minX, top: f.minY, width: w0, height: h0 })
        .resize(w, h)
        .png()
        .toBuffer();
      const sc = (v) => Math.round(v * scale);
      frames.push({
        pose: poses[i],
        png,
        w,
        h,
        // Relative to the frame's top-left: anchor (head over the feet line),
        // muzzle for forward and upward shots.
        anchorX: sc(f.headX - f.minX),
        muzzle: [sc(f.tip.x - f.minX), sc(f.tip.y - f.minY)],
        muzzleUp: [sc(f.top.x - f.minX), 0],
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
