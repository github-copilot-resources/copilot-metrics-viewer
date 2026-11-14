import { expect, test, vi } from 'vitest'
import { load } from 'webfontloader'

test('Nuxt initializes Vuetify without starting external font requests in unit tests', () => {
  expect(vi.isMockFunction(load)).toBe(true)
  expect(load).toHaveBeenCalled()
  expect(document.querySelector('link[href*="fonts.googleapis.com"]')).toBeNull()
})
