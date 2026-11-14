import { describe, expect, test } from 'vitest'
import { shouldShowActiveTabLoading } from '../app/utils/tabUtils'

describe('shouldShowActiveTabLoading', () => {
  test('shows loading for seat analysis while seats data is not ready', () => {
    expect(shouldShowActiveTabLoading({
      tab: 'seat analysis',
      signInRequired: false,
      metricsReady: true,
      seatsReady: false,
      userMetricsReady: true,
    })).toBe(true)
  })

  test('shows loading for user metrics while user metrics data is not ready', () => {
    expect(shouldShowActiveTabLoading({
      tab: 'user metrics',
      signInRequired: false,
      metricsReady: true,
      seatsReady: true,
      userMetricsReady: false,
    })).toBe(true)
  })

  test('does not show loading on seat analysis when seats data is ready', () => {
    expect(shouldShowActiveTabLoading({
      tab: 'seat analysis',
      signInRequired: false,
      metricsReady: true,
      seatsReady: true,
      userMetricsReady: true,
    })).toBe(false)
  })

  test('does not show loading when sign in is required', () => {
    expect(shouldShowActiveTabLoading({
      tab: 'seat analysis',
      signInRequired: true,
      metricsReady: false,
      seatsReady: false,
      userMetricsReady: false,
    })).toBe(false)
  })
})
