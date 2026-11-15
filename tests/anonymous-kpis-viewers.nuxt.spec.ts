// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import SeatsAnalysisViewer from '../app/components/SeatsAnalysisViewer.vue';
import UserMetricsViewer from '../app/components/UserMetricsViewer.vue';

describe('anonymous KPI viewers', () => {
  it('renders global assigned count, not the permitted detail count; partial activity stays unavailable', async () => {
    const wrapper = await mountSuspended(SeatsAnalysisViewer, {
      props: {
        seats: [], totalSeatsCount: 1,
        summary: { assigned: 901, never_used: null, inactive_7: null, inactive_30: null },
      },
      global: { stubs: { Line: true } },
    });
    try {
      expect(wrapper.findAll('.kpi-value').map(tile => tile.text())).toEqual([
        '901', 'Unavailable', 'Unavailable', 'Unavailable',
      ]);
      expect(wrapper.text()).toContain('Permitted seat details');
    } finally { wrapper.unmount(); }
  });
  it('uses global counts and a weighted rate independently of the visible rows and clears unavailable data', async () => {
    const wrapper = await mountSuspended(UserMetricsViewer, {
      props: {
        userMetrics: [],
        summary: { total_users: 2, active_users: 1, generated: 100, accepted: 18 },
      },
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, Line: true, Bar: true, Doughnut: true } },
    });
    try {
      expect(wrapper.findAll('.kpi-value').map(tile => tile.text())).toEqual(['2', '1', '18.0%']);
      expect(wrapper.text()).toContain('Permitted user details');
      await wrapper.setProps({ summary: null });
      expect(wrapper.findAll('.kpi-value').map(tile => tile.text())).toEqual([
        'Unavailable', 'Unavailable', 'Unavailable',
      ]);
      expect(wrapper.text()).toContain('Scope-wide user summary unavailable');
    } finally { wrapper.unmount(); }
  });
});
