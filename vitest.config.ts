import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // any custom Vitest config you require
  test: {
    exclude: ['**/node_modules/**', '**/e2e-tests/**'],
    environment: 'nuxt',
    globals: true // Use describe, test/expect, etc. without importing
  }
})
