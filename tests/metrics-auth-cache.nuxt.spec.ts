// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { buildMetricsCacheKey } from '../shared/utils/metrics-util'

/**
 * These tests validate that the new cache key generation logic binds cache entries
 * to the caller's Authorization header fingerprint and that different auth headers
 * produce distinct keys even when path + query are identical.
 */

describe('Metrics Auth-Bound Cache Key', () => {
  const path = '/api/metrics'
  const query = { since: '2024-01-01', until: '2024-01-31', scope: 'organization', githubOrg: 'test-org' }

  it('produces different keys for different auth headers', () => {
    const keyA1 = buildMetricsCacheKey(path, query, 'token userA-1')
    const keyA2 = buildMetricsCacheKey(path, query, 'token userA-2')
    const keyB = buildMetricsCacheKey(path, query, 'token userB-1')

    expect(keyA1).not.toBe(keyA2)
    expect(keyA1.split(':')[0]).not.toBe(keyA2.split(':')[0])
    expect(keyA1.split(':')[0]).not.toBe(keyB.split(':')[0])
  })

  it('is stable for same auth header + query', () => {
    const key1 = buildMetricsCacheKey(path, query, 'token stable-user')
    const key2 = buildMetricsCacheKey(path, query, 'token stable-user')
    expect(key1).toBe(key2)
  })

  it('filters out undefined/empty query params', () => {
    const key = buildMetricsCacheKey(path, { since: '2024-01-01', empty: '', undef: undefined }, 'token x')
    expect(key).toContain('since=2024-01-01')
    expect(key).not.toContain('empty=')
    expect(key).not.toContain('undef=')
  })

  it('joins array query params deterministically', () => {
    const key = buildMetricsCacheKey(path, { since: ['2024-01-01'], tag: ['a','b'] }, 'token y')
    expect(key).toContain('since=2024-01-01')
    expect(key).toMatch(/tag=a%2Cb|tag=b%2Ca/) // order preserved from input array join
  })

  it('merges existing path query params with provided query object without duplication', () => {
    const pathWithQuery = '/api/metrics?since=2024-01-01&scope=organization'
    const key = buildMetricsCacheKey(pathWithQuery, { githubOrg: 'test-org', since: '2024-01-01' }, 'token z')
    // should not duplicate since param and should include githubOrg
    const pieces = key.split(':')
    expect(pieces.length).toBeGreaterThan(1)
    const qs = pieces.slice(1).join(':').split('?')[1]
    expect(qs?.match(/since=/g)?.length).toBe(1)
    expect(qs).toContain('githubOrg=test-org')
  })

  it('sorts final query params for stable ordering', () => {
    const key1 = buildMetricsCacheKey('/api/metrics?b=2&a=1', { c: '3' }, 'token sort')
    const key2 = buildMetricsCacheKey('/api/metrics?a=1&b=2', { c: '3' }, 'token sort')
    expect(key1).toBe(key2)
  const qs = key1.split('?')[1]
  expect(qs).toBeDefined()
  expect(qs!.startsWith('a=1&b=2&c=3')).toBe(true)
  })
})
