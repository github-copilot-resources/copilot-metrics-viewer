import { describe, it, expect } from 'vitest'
import { normalizeBaseURL, joinBaseURL } from '../shared/utils/base-url'

describe('normalizeBaseURL', () => {
  it('returns "/" for an empty string', () => {
    expect(normalizeBaseURL('')).toBe('/')
  })

  it('returns "/" unchanged', () => {
    expect(normalizeBaseURL('/')).toBe('/')
  })

  it('adds a trailing slash when missing', () => {
    expect(normalizeBaseURL('/copilot-metrics-viewer')).toBe('/copilot-metrics-viewer/')
  })

  it('preserves a trailing slash when already present', () => {
    expect(normalizeBaseURL('/copilot-metrics-viewer/')).toBe('/copilot-metrics-viewer/')
  })

  it('handles nested sub-paths', () => {
    expect(normalizeBaseURL('/a/b/c')).toBe('/a/b/c/')
  })
})

describe('joinBaseURL', () => {
  describe('with root base "/"', () => {
    it('returns "/" for path "/"', () => {
      expect(joinBaseURL('/', '/')).toBe('/')
    })

    it('returns "/" for empty path', () => {
      expect(joinBaseURL('/', '')).toBe('/')
    })

    it('returns "/select-org" for path "/select-org"', () => {
      expect(joinBaseURL('/', '/select-org')).toBe('/select-org')
    })

    it('returns "/orgs/my-org" for path "/orgs/my-org"', () => {
      expect(joinBaseURL('/', '/orgs/my-org')).toBe('/orgs/my-org')
    })
  })

  describe('with sub-path base "/copilot-metrics-viewer/"', () => {
    const base = '/copilot-metrics-viewer/'

    it('returns the base for path "/"', () => {
      expect(joinBaseURL(base, '/')).toBe('/copilot-metrics-viewer/')
    })

    it('returns the base for an empty path', () => {
      expect(joinBaseURL(base, '')).toBe('/copilot-metrics-viewer/')
    })

    it('prepends base to "/select-org"', () => {
      expect(joinBaseURL(base, '/select-org')).toBe('/copilot-metrics-viewer/select-org')
    })

    it('prepends base to "/orgs/my-org"', () => {
      expect(joinBaseURL(base, '/orgs/my-org')).toBe('/copilot-metrics-viewer/orgs/my-org')
    })

    it('handles paths with multiple leading slashes', () => {
      expect(joinBaseURL(base, '//select-org')).toBe('/copilot-metrics-viewer/select-org')
    })
  })

  describe('with sub-path base missing trailing slash', () => {
    it('normalizes base before joining', () => {
      expect(joinBaseURL('/sub', '/page')).toBe('/sub/page')
    })
  })
})
