// Builds the installed app's icons (public/icons/) from the official logo.
//
//   node scripts/makePwaIcons.mjs [source image]
//
// Default source: public/bomavibes-logo.jpeg (256×256, so the 512 px icons are
// enlarged from it). Run again with a larger logo (1024 px or more) for sharper
// icons on big screens. sharp comes from the backend, which already has it.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, '../backend/package.json'))
const sharp = require('sharp')

const source = process.argv[2] || join(root, 'public/bomavibes-logo.jpeg')
const outDir = join(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
// A 256-colour palette: a quarter of the size, no visible difference at icon size.
const PNG = { palette: true, quality: 90, compressionLevel: 9, effort: 10 }

// The logo already sits on white with a margin: shown whole.
async function plain(size, name) {
  await sharp(source).resize(size, size, { fit: 'contain', background: WHITE, kernel: 'lanczos3' }).flatten({ background: WHITE }).png(PNG).toFile(join(outDir, name))
}

// Android crops "maskable" icons to a circle, a squircle… whose safe zone is
// the centred circle of 80% of the width: the logo is shrunk to stay inside it.
async function maskable(size, name) {
  const inner = Math.round(size * 0.72)
  const logo = await sharp(source).resize(inner, inner, { fit: 'contain', background: WHITE, kernel: 'lanczos3' }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'centre' }])
    .flatten({ background: WHITE })
    .png(PNG)
    .toFile(join(outDir, name))
}

await plain(192, 'icon-192.png')
await plain(512, 'icon-512.png')
await maskable(512, 'icon-maskable-512.png')
await plain(180, 'apple-touch-icon.png')
console.log(`Icons written to ${outDir}`)
