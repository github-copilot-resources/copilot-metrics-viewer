// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import MetricsViewer from '../app/components/MetricsViewer.vue'
import MyUsageViewer from '../app/components/MyUsageViewer.vue'
import type { ReportDayTotals, UserTotals } from '../server/services/github-copilot-usage-api'

const { mockUseFetch } = vi.hoisted(() => ({
  mockUseFetch: vi.fn(),
}))

mockNuxtImport('useFetch', () => mockUseFetch)

const modelFeature = (model: string, count: number) => ({
  model,
  feature: 'chat_panel_ask_mode',
  user_initiated_interaction_count: count,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_suggested_to_delete_sum: 0,
  loc_added_sum: 0,
  loc_deleted_sum: 0,
})

const reportDay = (totals_by_model_feature: ReturnType<typeof modelFeature>[]): ReportDayTotals => ({
  day: '2026-07-01',
  organization_id: 'org1',
  enterprise_id: 'ent1',
  daily_active_users: 5,
  weekly_active_users: 5,
  monthly_active_users: 5,
  monthly_active_agent_users: 1,
  user_initiated_interaction_count: 128,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  totals_by_ide: [],
  totals_by_feature: [
    {
      feature: 'chat_panel_ask_mode',
      user_initiated_interaction_count: 128,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      loc_suggested_to_add_sum: 0,
      loc_suggested_to_delete_sum: 0,
      loc_added_sum: 0,
      loc_deleted_sum: 0,
    },
  ],
  totals_by_language_feature: [],
  totals_by_language_model: [],
  totals_by_model_feature,
  loc_suggested_to_add_sum: 0,
  loc_suggested_to_delete_sum: 0,
  loc_added_sum: 0,
  loc_deleted_sum: 0,
})

const userTotals = (totals_by_model_feature: ReturnType<typeof modelFeature>[]): UserTotals => ({
  login: 'octocat',
  user_id: 1,
  total_active_days: 1,
  user_initiated_interaction_count: 128,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_suggested_to_delete_sum: 0,
  loc_added_sum: 0,
  loc_deleted_sum: 0,
  totals_by_ide: [],
  totals_by_feature: [],
  totals_by_language_feature: [],
  totals_by_model_feature,
})

describe('top chat model selection', () => {
  const wrappers: VueWrapper[] = []
  const global = { stubs: { VMain: { template: '<main><slot /></main>' } } }

  beforeEach(() => {
    mockUseFetch.mockReset()
  })

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('MetricsViewer skips synthetic others bucket when picking the most used chat model', async () => {
    const wrapper = await mountSuspended(MetricsViewer, {
      props: {
        metrics: [],
        reportData: [
          reportDay([
            modelFeature('others', 100),
            modelFeature('gpt-4.1', 25),
            modelFeature('claude-3.7-sonnet', 3),
          ]),
        ],
      },
      global: {
        stubs: {
          VMain: { template: '<main><slot /></main>' },
        },
      },
    })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain('gpt-4.1')
    expect(wrapper.text()).not.toContain('others')
  })

  it('MyUsageViewer skips synthetic Unknown bucket when picking the top model', async () => {
    mockUseFetch.mockResolvedValue({
      data: ref({
        user: { login: 'octocat' },
        totals: userTotals([
          modelFeature('Unknown', 100),
          modelFeature('claude-3.7-sonnet', 25),
        ]),
        dayRecords: [],
      }),
      pending: ref(false),
      error: ref(null),
    })

    const wrapper = await mountSuspended(MyUsageViewer, {
      global: {
        stubs: {
          VMain: { template: '<main><slot /></main>' },
        },
      },
    })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain('claude-3.7-sonnet')
    expect(wrapper.text()).not.toContain('Unknown')
  })

  it.each(['others', 'OTHERS', 'Unknown', 'uNkNoWn', ''])(
    'both viewers ignore the %j bucket without changing source metrics',
    async bucket => {
      const models = [
        modelFeature('claude-3.7-sonnet', 3),
        modelFeature(bucket, 100),
        modelFeature('gpt-4.1', 25),
      ]
      const report = [reportDay(models)]
      const totals = userTotals(models)
      const snapshot = JSON.parse(JSON.stringify({ report, totals }))
      mockUseFetch.mockResolvedValue({
        data: ref({ user: { login: 'octocat' }, totals, dayRecords: [] }),
        pending: ref(false),
        error: ref(null),
      })

      const metrics = await mountSuspended(MetricsViewer, {
        props: { metrics: [], reportData: report },
        global,
      })
      wrappers.push(metrics)
      const usage = await mountSuspended(MyUsageViewer, { global })
      wrappers.push(usage)

      const modelTile = metrics.findAll('.tiles-text')
        .find(tile => tile.text().includes('Most used chat model'))
      expect(modelTile?.find('.kpi-value').text()).toBe('gpt-4.1')
      expect(usage.find('strong').text()).toBe('gpt-4.1')
      expect({ report, totals }).toEqual(snapshot)
    },
  )

  it.each([
    { name: 'only synthetic buckets', models: [modelFeature('others', 100), modelFeature('Unknown', 90), modelFeature('', 80)] },
    { name: 'no model rows', models: [] },
  ])('both viewers safely handle $name', async ({ models }) => {
    mockUseFetch.mockResolvedValue({
      data: ref({ user: { login: 'octocat' }, totals: userTotals(models), dayRecords: [] }),
      pending: ref(false),
      error: ref(null),
    })
    const metrics = await mountSuspended(MetricsViewer, {
      props: { metrics: [], reportData: [reportDay(models)] },
      global,
    })
    wrappers.push(metrics)
    const usage = await mountSuspended(MyUsageViewer, { global })
    wrappers.push(usage)

    const modelTile = metrics.findAll('.tiles-text')
      .find(tile => tile.text().includes('Most used chat model'))
    expect(modelTile?.find('.kpi-value').text()).toBe('—')
    expect(usage.text()).not.toContain('Top model')
    expect(usage.text()).toContain('Interactions')
  })

  it('MetricsViewer aggregates named models across days and chat modes, excluding completions', async () => {
    const completion = { ...modelFeature('completion-only', 1000), feature: 'code_completion' }
    const report = [
      reportDay([modelFeature('others', 100), modelFeature('gpt-4.1', 20), modelFeature('claude-3.7-sonnet', 30), completion]),
      { ...reportDay([{ ...modelFeature('gpt-4.1', 20), feature: 'chat_panel_agent_mode' }]), day: '2026-07-02' },
    ]
    const snapshot = JSON.parse(JSON.stringify(report))
    const metrics = await mountSuspended(MetricsViewer, {
      props: { metrics: [], reportData: report },
      global,
    })
    wrappers.push(metrics)

    const modelTile = metrics.findAll('.tiles-text')
      .find(tile => tile.text().includes('Most used chat model'))
    expect(modelTile?.find('.kpi-value').text()).toBe('gpt-4.1')
    expect(report).toEqual(snapshot)
  })
})
