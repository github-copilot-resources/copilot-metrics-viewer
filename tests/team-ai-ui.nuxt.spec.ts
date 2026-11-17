// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamAiLocTrend from '../app/components/TeamAiLocTrend.vue';
import TeamPrWeekly from '../app/components/TeamPrWeekly.vue';
import AgentActivityViewer from '../app/components/AgentActivityViewer.vue';
import TeamLeaderboard from '../app/components/TeamLeaderboard.vue';
import type { ReportDayTotals } from '../server/services/github-copilot-usage-api';
import type { TeamPrMetrics } from '../server/services/team-pr-search';

vi.mock('vue-chartjs', async importOriginal => {
  const actual = await importOriginal<typeof import('vue-chartjs')>();
  const { defineComponent, h } = await import('vue');
  const chart = defineComponent({ name: 'TestChart', props: ['data', 'options'], render: () => h('div') });
  return { ...actual, Line: chart, Bar: chart };
});

function day(date: string, loc: number, agentLoc: number): ReportDayTotals {
  const activity = {
    user_initiated_interaction_count: 0, code_generation_activity_count: 0,
    code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0,
    loc_suggested_to_delete_sum: 0, loc_added_sum: agentLoc, loc_deleted_sum: 0,
  };
  return {
    ...activity, day: date, organization_id: '1', enterprise_id: '',
    daily_active_users: 0, weekly_active_users: 0, monthly_active_users: 0,
    totals_by_ide: [], totals_by_language_feature: [], totals_by_language_model: [],
    totals_by_model_feature: [], totals_by_feature: [{ ...activity, feature: 'agent_edit' }],
    loc_added_sum: loc,
  };
}

const metrics: TeamPrMetrics = {
  weeks: [], totalMerged: 10, totalAiTouched: 2, rollingAverage: 5,
  avgMergedPerPerson: 2, memberCount: 5, truncated: false, orgScoped: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('team AI UI', () => {
  it('uses direct added LOC, not added plus deleted LOC or agent-chat blocks, in Agent Activity', async () => {
    const record = day('2026-10-04', 100, 25);
    record.loc_deleted_sum = 50;
    record.totals_by_feature[0]!.loc_deleted_sum = 50;
    record.totals_by_feature.push({ ...record.totals_by_feature[0]!, feature: 'chat_panel_agent_mode', loc_added_sum: 15, loc_deleted_sum: 0 });
    record.totals_by_feature.push({ ...record.totals_by_feature[0]!, feature: 'chat_panel_edit_mode', loc_added_sum: 10, loc_deleted_sum: 0 });
    const wrapper = await mountSuspended(AgentActivityViewer, { props: { reportData: [record] } });
    expect(wrapper.get('[data-testid="agent-loc-share"]').text()).toContain('Agent share of Copilot-added LOC');
    expect(wrapper.get('[data-testid="agent-loc-share"]').text()).toContain('25.0%');
    expect(wrapper.get('[data-testid="agent-loc-share"]').text()).toContain('25 of 100 added lines');
    const userModes = wrapper.findAllComponents({ name: 'TestChart' })
      .map(chart => chart.props('data')).find(data => data.labels.includes('Edit'));
    expect(userModes.labels).toEqual(['Agent', 'Edit']);
    expect(userModes.datasets.find((dataset: { label: string }) => dataset.label === 'Added').data).toEqual([15, 10]);
    await wrapper.setProps({ reportData: [day('2026-10-04', 0, 0)] });
    expect(wrapper.get('[data-testid="agent-loc-share"]').text()).toContain('—');
    await wrapper.setProps({ reportData: [] });
    expect(wrapper.get('[data-testid="agent-loc-share"]').text()).toContain('—');
    wrapper.unmount();
  });

  it('charts daily LOC percentages and leaves zero-denominator days as gaps', async () => {
    const wrapper = await mountSuspended(TeamAiLocTrend, {
      props: { teams: [{
        slug: 'qa', teamName: 'QA Team', color: '#123456', memberCount: 3,
        reportData: [day('2026-10-02', 100, 25), day('2026-10-03', 0, 0), day('2026-10-04', 200, 100)],
      }] },
    });
    const data = wrapper.findComponent({ name: 'TestChart' }).props('data');
    expect(data.labels).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(data.datasets[0].data).toEqual([25, null, 50]);
    wrapper.unmount();
  });

  it('clears PR results when team or range changes and ignores an older in-flight request', async () => {
    let resolve!: (value: TeamPrMetrics) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<TeamPrMetrics>(done => { resolve = done; }));
    vi.stubGlobal('$fetch', fetchMock);
    const wrapper = await mountSuspended(TeamPrWeekly, { props: { params: { githubTeam: 'qa' }, teamName: 'QA Team' } });
    await wrapper.get('button').trigger('click');
    await wrapper.setProps({ params: { githubTeam: 'frontend' }, teamName: 'Frontend Team' });
    resolve(metrics);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Merged per person');
    expect(wrapper.emitted('metrics')?.at(-1)).toEqual([null]);
    fetchMock.mockResolvedValueOnce(metrics);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Merged per person');
    expect(wrapper.emitted('metrics')?.at(-1)).toEqual([metrics]);
    await wrapper.setProps({ params: { githubTeam: 'frontend' } });
    expect(wrapper.text()).toContain('Merged per person');
    await wrapper.setProps({ params: { githubTeam: 'frontend', since: '2026-10-01' } });
    expect(wrapper.text()).not.toContain('Merged per person');
    expect(wrapper.emitted('metrics')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it('ranks loaded merged PR counts and keeps unloaded teams unranked', async () => {
    const team = { slug: 'qa', teamName: 'QA', color: '#123456', memberCount: 5, reportData: [] };
    const prMetrics = { ...metrics, weeks: [
      { weekStart: '2026-09-28', weekEnd: '2026-09-30', partial: true, merged: 999, aiTouched: 0 },
      { weekStart: '2026-10-05', weekEnd: '2026-10-11', partial: false, merged: 5, aiTouched: 0 },
      { weekStart: '2026-10-12', weekEnd: '2026-10-18', partial: false, merged: 10, aiTouched: 0 },
    ] };
    const wrapper = await mountSuspended(TeamLeaderboard, { props: { teams: [
      { ...team, prMetrics },
      { ...team, slug: 'dev', teamName: 'Development', prMetrics: { ...prMetrics, totalMerged: 20, avgMergedPerPerson: 4 } },
      { ...team, slug: 'other', teamName: 'Other' },
    ] } });
    const select = wrapper.findComponent({ name: 'VSelect' });
    expect(select.props('items')).toContainEqual({ key: 'prsMerged', label: 'PRs Merged', format: 'int' });
    select.vm.$emit('update:modelValue', 'prsMerged');
    await flushPromises();
    const rows = wrapper.findAll('tbody tr');
    expect(rows[0]!.text()).toContain('Development');
    expect(rows[0]!.text()).toContain('20');
    expect(rows[1]!.text()).toContain('QA');
    expect(rows[1]!.text()).toContain('▲ 100%');
    expect(rows[2]!.text()).toContain('Not loaded');
    select.vm.$emit('update:modelValue', 'prsMergedPerPerson');
    await flushPromises();
    expect(wrapper.findAll('tbody tr')[0]!.text()).toContain('4.0');
    await wrapper.setProps({ teams: [{ ...team, prMetrics: { ...prMetrics, truncated: true } }] });
    expect(wrapper.find('tbody').text()).toContain('≥ 2.0');
    expect(wrapper.find('tbody').text()).not.toContain('100%');
    await wrapper.setProps({ teams: [{ ...team, prMetrics: null }] });
    expect(wrapper.find('tbody').text()).not.toContain('10');
    wrapper.unmount();
  });

  it('displays the retry delay from the endpoint rate-limit response', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ statusCode: 429, data: { data: { retryAfterMinutes: 8 } } }));
    const wrapper = await mountSuspended(TeamPrWeekly, { props: { params: { githubTeam: 'qa' } } });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('about 8 minutes');
    expect(wrapper.emitted('metrics')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });
});
