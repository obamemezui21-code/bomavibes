import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// What WhatsApp, Facebook, Telegram… show for a shared link. They read the
// page's tags and never run the app, so a page with its own picture has to
// exist as a real file: the server answers /jouer/ with jouer/index.html when
// it exists, and with the app's index.html otherwise. The app itself runs the
// same in both. index.html holds the default tags, between these two marks.

const SITE = 'https://bomavibes.tech'
const START = '<!-- link-preview -->'
const END = '<!-- /link-preview -->'

export const PREVIEW_PAGES = [
  {
    path: 'jouer',
    title: 'NGORI RUN : viens jouer avec moi sur BomaVibes',
    description: 'Cours, saute et esquive les taxis de Libreville. Joue gratuitement, sans créer de compte !',
    image: '/og/ngori-run.jpg',
  },
]

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

export function previewTags({ path, title, description, image }) {
  const url = `${SITE}/${path ? `${path}/` : ''}`
  const [t, d] = [escape(title), escape(description)]
  return [
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="BomaVibes" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}${image}" />`,
    `<meta property="og:image:secure_url" content="${SITE}${image}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${SITE}${image}" />`,
  ].join('\n    ')
}

// The built index.html with another page's tags.
export function pageWithPreview(html, page) {
  const from = html.indexOf(START)
  const to = html.indexOf(END)
  if (from < 0 || to < 0) throw new Error('index.html has no link preview marks')
  return `${html.slice(0, from)}${START}\n    ${previewTags(page)}\n    ${html.slice(to)}`.replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
}

export function linkPreviewPages() {
  let outDir = 'dist'
  return {
    name: 'link-preview-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
      for (const page of PREVIEW_PAGES) {
        const file = join(outDir, page.path, 'index.html')
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, pageWithPreview(html, page))
      }
    },
  }
}
