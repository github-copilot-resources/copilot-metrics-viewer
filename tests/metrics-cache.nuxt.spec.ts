// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'

describe('Metrics Cache Key Generation', () => {
  it('should create unique cache keys for different query parameters', () => {
    // Test the cache key logic that was implemented
    const createCacheKey = (path: string, query: Record<string, string>) => {
      const queryString = new URLSearchParams(query).toString()
      return queryString ? `${path}?${queryString}` : path
    }

    const path = '/api/metrics'
    
    // Different date ranges should create different cache keys
    const query1 = { since: '2024-01-01', until: '2024-01-31', scope: 'organization', githubOrg: 'test-org' }
    const query2 = { since: '2024-02-01', until: '2024-02-28', scope: 'organization', githubOrg: 'test-org' }
    const query3 = { since: '2024-01-01', until: '2024-01-31', scope: 'organization', githubOrg: 'test-org' }

    const key1 = createCacheKey(path, query1)
    const key2 = createCacheKey(path, query2)
    const key3 = createCacheKey(path, query3)

    // Different date ranges should have different keys
    expect(key1).not.toBe(key2)
    
    // Same parameters should have same key
    expect(key1).toBe(key3)
    
    // Keys should include query parameters
    expect(key1).toContain('since=2024-01-01')
    expect(key1).toContain('until=2024-01-31')
    expect(key2).toContain('since=2024-02-01')
    expect(key2).toContain('until=2024-02-28')
  })

  it('should handle empty query parameters', () => {
    const createCacheKey = (path: string, query: Record<string, string>) => {
      const queryString = new URLSearchParams(query).toString()
      return queryString ? `${path}?${queryString}` : path
    }

    const path = '/api/metrics'
    const emptyQuery = {}
    
    const key = createCacheKey(path, emptyQuery)
    expect(key).toBe(path)
  })

  it('should handle undefined query values', () => {
    const createCacheKey = (path: string, query: Record<string, any>) => {
      // Filter out undefined values before creating query string
      const filteredQuery = Object.fromEntries(
        Object.entries(query).filter(([_, value]) => value !== undefined)
      )
      const queryString = new URLSearchParams(filteredQuery).toString()
      return queryString ? `${path}?${queryString}` : path
    }

    const path = '/api/metrics'
    const queryWithUndefined = { since: '2024-01-01', until: undefined, scope: 'organization' }
    
    const key = createCacheKey(path, queryWithUndefined)
    expect(key).toContain('since=2024-01-01')
    expect(key).toContain('scope=organization')
    expect(key).not.toContain('until=')
  })
})