import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { linkPreviewPages } from './linkPreviews.js'

// The installable app: manifest + the one service worker, which also receives
// the push notifications (see src/firebase-messaging-sw.js for what it caches).
const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'firebase-messaging-sw.js',
  // A new version waits for the member's go-ahead (UpdatePrompt.jsx).
  registerType: 'prompt',
  // Registered from src/lib/pwa.js.
  injectRegister: false,
  injectManifest: {
    // Only the page and the notifications' icon: the code files are kept as
    // they're used, the large icons are fetched by the system when installing.
    globPatterns: ['index.html', 'icons/icon-192.png'],
    rollupFormat: 'iife',
  },
  includeManifestIcons: false,
  manifest: {
    id: '/',
    name: 'BomaVibes',
    short_name: 'BomaVibes',
    description: 'Connectez-vous, échangez et découvrez de nouvelles personnes au Gabon.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    // The splash's purple (index.html, SplashScreen): no white flash between
    // the system's launch screen and the app.
    theme_color: '#4b164c',
    background_color: '#4b164c',
    lang: 'fr',
    dir: 'ltr',
    categories: ['social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // No service worker while developing (the dev server's files change all the time).
  devOptions: { enabled: false },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), linkPreviewPages(), pwa],
  server: {
    // The NGORI RUN engine lives in ../shared (the backend replays runs with it).
    fs: { allow: ['.', '../shared'] },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // flag-icons' ~400 small SVG flags were all inlined into the main CSS
    // (570 KB downloaded on every visit, flags shown or not). Kept as
    // separate files instead, each fetched only when a flag is displayed.
    assetsInlineLimit: (filePath) => (filePath.includes('flag-icons') ? false : undefined),
    rolldownOptions: {
      output: {
        // Firebase (auth+firestore+app-check) and framer-motion rarely
        // change between deploys but were previously fused into
        // AuthContext/ToastContext's own chunk — any unrelated app-code
        // edit busted the browser cache for these heavy vendor bundles too.
        // Splitting them out lets returning visitors skip re-downloading
        // them across releases.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Before vendor-firebase, or it would pull push back into every visit.
            if (/firebase\/(messaging|installations)\//.test(id)) return 'vendor-firebase-push'
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase'
            if (id.includes('framer-motion')) return 'vendor-framer-motion'
            if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
            // Each lucide icon used to land in its own 1–2 KB chunk: ~35
            // requests on the landing page alone, a long waterfall on a
            // mobile connection. One file for all of them instead.
            if (id.includes('lucide-react')) return 'vendor-icons'
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
