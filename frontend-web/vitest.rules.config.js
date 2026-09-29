import { defineConfig } from 'vitest/config'

// Firestore security rules tests — need the Firestore emulator, so they run
// only through `npm run test:rules` (which starts it), never in `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
