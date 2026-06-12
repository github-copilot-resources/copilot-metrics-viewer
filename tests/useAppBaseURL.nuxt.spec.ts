// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAppBaseURL } from '../app/composables/useAppBaseURL'

// Mutable holder so each test can swap the stubbed baseURL without redefining
// the auto-import (mockNuxtImport runs once at module load).
const stubbedConfig = { app: { baseURL: '/' as string | undefined } }

mockNuxtImport('useRuntimeConfig', () => {
  return () => stubbedConfig
})

describe('useAppBaseURL', () => {
  it('returns "/" when baseURL is "/"', () => {
    stubbedConfig.app.baseURL = '/'
    expect(useAppBaseURL()).toBe('/')
  })

  it('returns "/" when baseURL is undefined', () => {
    stubbedConfig.app.baseURL = undefined
    expect(useAppBaseURL()).toBe('/')
  })

  it('returns "/" when baseURL is an empty string', () => {
    stubbedConfig.app.baseURL = ''
    expect(useAppBaseURL()).toBe('/')
  })

  it('adds a trailing slash when missing', () => {
    stubbedConfig.app.baseURL = '/copilot-metrics-viewer'
    expect(useAppBaseURL()).toBe('/copilot-metrics-viewer/')
  })

  it('preserves a trailing slash when already present', () => {
    stubbedConfig.app.baseURL = '/copilot-metrics-viewer/'
    expect(useAppBaseURL()).toBe('/copilot-metrics-viewer/')
  })

  it('handles nested sub-paths', () => {
    stubbedConfig.app.baseURL = '/a/b/c'
    expect(useAppBaseURL()).toBe('/a/b/c/')
  })

  it('produces a value safe to concatenate with a relative auth path under a sub-path', () => {
    stubbedConfig.app.baseURL = '/copilot-metrics-viewer/'
    expect(`${useAppBaseURL()}auth/github`).toBe('/copilot-metrics-viewer/auth/github')
  })

  it('produces a root-relative auth path when no sub-path is configured', () => {
    stubbedConfig.app.baseURL = '/'
    expect(`${useAppBaseURL()}auth/github`).toBe('/auth/github')
  })
})

