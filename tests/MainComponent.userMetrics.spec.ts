import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import MainComponent from '../app/components/MainComponent.vue'

describe('MainComponent user metrics requests', () => {
  test('terminates failed requests without replacing data with empty success and clears errors on retry', async () => {
    const previous = [{ login: 'previous-user' }]
    const data = ref<unknown>(null)
    const error = ref<{ statusCode: number; message: string } | null>(null)
    let release!: () => void
    const execute = vi.fn(async () => {
      await new Promise<void>(resolve => { release = resolve })
    })
    const state = {
      userMetrics: previous,
      userMetricsReady: true,
      userMetricsLoadError: undefined as string | undefined,
      userMetricsFetch: { execute, data, error },
    }
    const load = () => MainComponent.methods!.fetchUserMetrics.call(state as never)

    const failed = load()
    expect(state.userMetricsReady).toBe(false)
    error.value = { statusCode: 500, message: 'private server details' }
    release()
    await failed
    expect(state.userMetricsReady).toBe(true)
    expect(state.userMetricsLoadError).toContain('500 Internal Server Error')
    expect(state.userMetricsLoadError).not.toContain('private server details')
    expect(state.userMetrics).toBe(previous)

    const retry = load()
    expect(state.userMetricsReady).toBe(false)
    expect(state.userMetricsLoadError).toBeUndefined()
    error.value = null
    data.value = []
    release()
    await retry
    expect(state.userMetricsReady).toBe(true)
    expect(state.userMetricsLoadError).toBeUndefined()
    expect(state.userMetrics).toEqual([])
  })
})
