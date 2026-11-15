import { describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import MainComponent from '../app/components/MainComponent.vue'
import { currentKpiResponse, kpiRequestKey } from '../app/utils/anonymousKpis'

describe('MainComponent user metrics requests', () => {
  test('terminates failed requests without replacing data with empty success and clears errors on retry', async () => {
    const previous = [{ login: 'previous-user' }]
    const query = { githubOrg: 'synthetic-org' }
    const data = ref({ rows: previous, requestKey: kpiRequestKey(query) })
    const status = ref('success')
    const rows = computed(() => currentKpiResponse(data.value, status.value, query)?.rows ?? [])
    const error = ref<{ statusCode: number; message: string } | null>(null)
    let release!: () => void
    const execute = vi.fn(async () => {
      status.value = 'pending'
      await new Promise<void>(resolve => { release = resolve })
      status.value = error.value ? 'error' : 'success'
    })
    const state = {
      get userMetrics() { return rows.value },
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
    expect(state.userMetrics).toEqual([])

    const retry = load()
    expect(state.userMetricsReady).toBe(false)
    expect(state.userMetricsLoadError).toBeUndefined()
    error.value = null
    data.value = { rows: [], requestKey: kpiRequestKey(query) }
    release()
    await retry
    expect(state.userMetricsReady).toBe(true)
    expect(state.userMetricsLoadError).toBeUndefined()
    expect(state.userMetrics).toEqual([])
  })
})
