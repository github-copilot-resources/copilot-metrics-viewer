import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // any custom Vitest config you require
  test: {
    exclude: ['**/node_modules/**', '**/e2e-tests/**'],
    environment: 'nuxt',
    environmentOptions: { nuxt: { dotenv: { fileName: '/dev/null' } } },
    globals: true, // Use describe, test/expect, etc. without importing
    setupFiles: ['./tests/test.setup.ts']
  }
})
