import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
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
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase'
            if (id.includes('framer-motion')) return 'vendor-framer-motion'
            if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
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
