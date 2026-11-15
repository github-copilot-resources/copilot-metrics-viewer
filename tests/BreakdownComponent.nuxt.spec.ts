// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import BreakdownComponent from '../app/components/BreakdownComponent.vue'
import { Metrics } from '../app/model/Metrics'
import type { ReportDayTotals, UserTotals } from '../server/services/github-copilot-usage-api'

const counters = (generated = 0, accepted = 0, suggestedLines = 0, addedLines = 0) => ({
  code_generation_activity_count: generated,
  code_acceptance_activity_count: accepted,
  loc_suggested_to_add_sum: suggestedLines,
  loc_suggested_to_delete_sum: 0,
  loc_added_sum: addedLines,
  loc_deleted_sum: 0,
})
const language = (name: string, generated: number, accepted = 0, lines = 0, added = 0, feature = 'code_completion') => ({
  language: name, feature, ...counters(generated, accepted, lines, added),
})
const day = (date: string, languages: ReturnType<typeof language>[]): ReportDayTotals => ({
  day: date, organization_id: 'synthetic-org', enterprise_id: 'synthetic-ent',
  daily_active_users: 0, weekly_active_users: 0, monthly_active_users: 0,
  user_initiated_interaction_count: 0, ...counters(),
  totals_by_language_feature: languages,
  totals_by_language_model: languages.map(({ feature: _feature, ...entry }) => ({ ...entry, model: 'test-model' })),
  totals_by_ide: ['csharp', 'c#', 'cpp', 'c++'].map(ide => ({
    ide, user_initiated_interaction_count: 0, ...counters(1),
  })),
  totals_by_feature: [], totals_by_model_feature: [],
})
const user = (login: string, languages: ReturnType<typeof language>[]): UserTotals => ({
  login, user_id: 1, total_active_days: 1, user_initiated_interaction_count: 0,
  ...counters(), totals_by_language_feature: languages,
})
const legacyDay = (date: string, languages: ReturnType<typeof language>[]) => new Metrics({
  day: date, total_suggestions_count: 0, total_acceptances_count: 0,
  total_lines_suggested: 0, total_lines_accepted: 0, total_active_users: 0,
  total_chat_acceptances: 0, total_chat_turns: 0, total_active_chat_users: 0,
  breakdown: languages.map(entry => ({
    language: entry.language, editor: entry.language,
    suggestions_count: entry.code_generation_activity_count,
    acceptances_count: entry.code_acceptance_activity_count,
    lines_suggested: entry.loc_suggested_to_add_sum, lines_accepted: entry.loc_added_sum,
    active_users: 0, chat_acceptances: 0, chat_turns: 0, active_chat_users: 0,
  })),
})

describe('BreakdownComponent language display aliases', () => {
  const wrappers: VueWrapper[] = []
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
  const mount = async (props: {
    metrics: Metrics[]; breakdownKey: string; reportData?: ReportDayTotals[]; userMetrics?: UserTotals[];
  }) => {
    const wrapper = await mountSuspended(BreakdownComponent, {
      props,
      global: { stubs: { Pie: true, Bar: true, Doughnut: true, LineChart: true } },
    })
    wrappers.push(wrapper)
    return wrapper
  }
  const report = () => [
    day('2026-07-01', [
      language('csharp', 10, 9, 100, 90), language('c#', 90, 9, 900, 90),
      language('cpp', 20, 2, 200, 20), language('c++', 30, 3, 300, 30),
      language('CSharp', 0), language('typescript', 50),
    ]),
    day('2026-07-02', [language('csharp', 20, 2, 200, 20, 'chat_panel_agent_mode'), language('c++', 30, 3, 300, 30)]),
    day('2026-07-03', [language('c#', 0), language('cpp', 0)]),
  ]

  it('combines legacy table and chart counters before computing unequal-denominator rates', async () => {
    const metrics = report().map(d => legacyDay(d.day, d.totals_by_language_feature))
    const snapshot = structuredClone(metrics)
    const wrapper = await mount({ metrics, breakdownKey: 'language' })
    const vm = wrapper.vm
    expect(vm.numberOfBreakdowns).toBe(4)
    expect(vm.breakdownList.map(row => row.name)).toEqual(['c#', 'c++', 'CSharp', 'typescript'])
    expect(vm.breakdownList[0]).toMatchObject({
      name: 'c#', acceptedPrompts: 20, suggestedPrompts: 120,
      acceptedLinesOfCode: 200, suggestedLinesOfCode: 1200,
      acceptanceRateByCount: 20 / 120 * 100, acceptanceRateByLines: 200 / 1200 * 100,
    })
    expect(vm.breakdownList[1]).toMatchObject({ name: 'c++', acceptedPrompts: 8, suggestedPrompts: 80 })
    expect(vm.breakdownList[2]).toMatchObject({ acceptanceRateByCount: 0, acceptanceRateByLines: 0 })
    expect(vm.breakdownsChartDataTop5AcceptedPrompts.labels).toEqual(['c#', 'c++', 'CSharp', 'typescript'])
    expect(vm.breakdownsChartDataTop5AcceptedPrompts.datasets[0].data).toEqual([20, 8, 0, 0])
    expect(vm.breakdownsChartDataTop5AcceptedPromptsByCounts.datasets[0].data).toEqual(['16.67', '10.00', '0.00', '0.00'])
    expect(vm.breakdownsChartDataTop5AcceptedPromptsByLines.datasets[0].data).toEqual(['16.67', '10.00', '0.00', '0.00'])
    expect(wrapper.findAll('tbody tr').map(row => row.find('td').text())).toEqual(['c#', 'c++', 'CSharp', 'typescript'])
    expect(metrics).toEqual(snapshot)
  })

  it('uses the same enhanced table, count, daily, distribution, top-five and model categories', async () => {
    const reportData = report()
    reportData[0]!.totals_by_language_model.push(
      { language: 'csharp', model: 'second-model', ...counters(3) },
      { language: 'c#', model: 'second-model', ...counters(7) },
    )
    const snapshot = structuredClone(reportData)
    const wrapper = await mount({ metrics: [], breakdownKey: 'language', reportData })
    const vm = wrapper.vm
    const labels = ['c#', 'c++', 'typescript', 'CSharp']
    expect(vm.numberOfBreakdowns).toBe(4)
    expect(vm.enhancedLanguageList[0]).toEqual({
      language: 'c#', codeGenerations: 120, codeAcceptances: 20, linesGenerated: 1200,
      linesAdded: 200, features: ['code_completion', 'chat_panel_agent_mode'],
    })
    expect(vm.enhancedLanguageList[1]).toMatchObject({ language: 'c++', codeGenerations: 80, codeAcceptances: 8, linesGenerated: 800, linesAdded: 80 })
    expect(vm.enhancedChartDataTop5Generations.labels).toEqual(labels)
    expect(vm.enhancedChartDataTop5Generations.datasets[0].data).toEqual([120, 80, 50, 0])
    expect(vm.enhancedChartDataTop5LinesAdded.labels).toEqual(labels)
    expect(vm.enhancedChartDataTop5LinesAdded.datasets[0].data).toEqual([200, 80, 0, 0])
    expect(vm.distributionDonutData.labels).toEqual(labels)
    expect(vm.distributionDonutData.datasets[0].data).toEqual([120, 80, 50, 0])
    expect(vm.usagePerDayChartData.datasets.map(series => series.label)).toEqual(labels)
    expect(vm.usagePerDayChartData.datasets.map(series => series.data)).toEqual([
      [50, 40, 0], [25, 60, 0], [25, 0, 0], [0, 0, 0],
    ])
    expect(vm.modelPerLangChartData.labels).toEqual(labels)
    expect(vm.modelPerLangChartData.datasets[0]).toMatchObject({ label: 'test-model', data: [120, 80, 50, 0] })
    expect(vm.modelPerLangChartData.datasets[1]).toMatchObject({ label: 'second-model', data: [10, 0, 0, 0] })
    expect(wrapper.findAll('tbody tr').map(row => row.find('td').text())).toEqual(labels)
    expect(reportData).toEqual(snapshot)
  })

  it.each([['csharp', 'c#'], ['cpp', 'c++']])('guards zero denominators for %s / %s without changing inputs', async (alias, canonical) => {
    const metrics = [legacyDay('2026-07-01', [language(alias, 0), language(canonical, 0)])]
    const snapshot = structuredClone(metrics)
    const wrapper = await mount({ metrics, breakdownKey: 'language' })
    expect(wrapper.vm.breakdownList).toHaveLength(1)
    expect(wrapper.vm.breakdownList[0]).toMatchObject({ name: canonical, acceptanceRateByCount: 0, acceptanceRateByLines: 0 })
    expect(wrapper.vm.breakdownsChartDataTop5AcceptedPromptsByCounts.datasets[0].data).toEqual(['0.00'])
    expect(wrapper.vm.breakdownsChartDataTop5AcceptedPromptsByLines.datasets[0].data).toEqual(['0.00'])
    expect(metrics).toEqual(snapshot)
  })

  it('combines the same login across aliases and features before selecting the top three users', async () => {
    const userMetrics = [
      user('combined-user', [language('csharp', 40), language('c#', 30, 0, 0, 0, 'chat_panel_agent_mode')]),
      user('first-single', [language('c#', 60), language('cpp', 2)]),
      user('second-single', [language('csharp', 50), language('c++', 3)]),
      user('third-single', [language('c#', 45)]),
      user('combined-user', [language('csharp', 10), language('cpp', 4), language('c++', 5)]),
      user('zero-user', [language('c#', 0)]),
    ]
    const snapshot = structuredClone(userMetrics)
    const wrapper = await mount({ metrics: [], breakdownKey: 'language', reportData: report() })
    await wrapper.setProps({ userMetrics })
    expect([...wrapper.vm.topUsersPerLanguage.keys()]).toEqual(['c#', 'c++'])
    expect(wrapper.vm.topUsersPerLanguage.get('c#')).toEqual([
      { login: 'combined-user', gen: 80 }, { login: 'first-single', gen: 60 }, { login: 'second-single', gen: 50 },
    ])
    expect(wrapper.vm.topUsersPerLanguage.get('c++')).toEqual([
      { login: 'combined-user', gen: 9 }, { login: 'second-single', gen: 3 }, { login: 'first-single', gen: 2 },
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows.find(row => row.text().includes('combined-user'))?.text()).toContain('(80)')
    expect(userMetrics).toEqual(snapshot)
  })

  it('leaves legacy and enhanced editor categories unchanged', async () => {
    const reportData = report()
    const metrics = reportData.map(d => legacyDay(d.day, d.totals_by_language_feature))
    const legacy = await mount({ metrics, breakdownKey: 'editor' })
    expect(legacy.vm.breakdownList.map(row => row.name)).toEqual(['csharp', 'c#', 'c++', 'cpp', 'CSharp', 'typescript'])
    const enhanced = await mount({ metrics: [], breakdownKey: 'editor', reportData })
    expect(enhanced.vm.enhancedEditorList.map(row => row.ide)).toEqual(['csharp', 'c#', 'cpp', 'c++'])
    expect(enhanced.vm.numberOfBreakdowns).toBe(4)
    expect(enhanced.vm.distributionDonutData.labels).toEqual(['csharp', 'c#', 'cpp', 'c++'])
  })
})
