import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import SeatsAnalysisViewer from '@/components/SeatsAnalysisViewer.vue';
import { downloadCSV } from '@/utils/csvExport';
import type { Seat } from '@/model/Seat';

vi.mock('@/utils/csvExport', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/csvExport')>(),
  downloadCSV: vi.fn(),
}));

const seat = (login: string, last_activity_at: string): Seat => ({
  login, id: 0, team: 'synthetic-team', created_at: '2026-01-01',
  plan_type: 'business', last_activity_at, last_activity_editor: 'synthetic-editor',
});

describe('SeatsAnalysisViewer current-page CSV', () => {
  afterEach(() => vi.clearAllMocks());

  it('exports displayed cells only, follows header sorting, and replaces the dataset after pagination', async () => {
    const wrapper = await mountSuspended(SeatsAnalysisViewer, {
      props: {
        seats: [seat('alpha', '2026-01-03'), seat('zulu', '2026-01-02')],
        currentPage: 1, totalPages: 2, perPage: 2, totalSeatsCount: 3,
      },
      global: { stubs: { Line: true } },
    });
    try {
      const action = () => wrapper.findAll('button').find(button => button.text() === 'Export current page (CSV)')!;
      const displayedRows = () => wrapper.findAll('tbody tr').map(row => row.findAll('td').map(cell => cell.text()).join(','));
      expect(action()).toBeDefined();
      await action().trigger('click');
      const csv = () => vi.mocked(downloadCSV).mock.lastCall![0];
      expect(csv().split('\r\n').slice(1)).toEqual(displayedRows());
      expect(csv().split('\r\n')[0]).toBe(wrapper.findAll('thead th').map(header => header.text()).join(','));
      expect(csv()).toContain('1,zulu,0,synthetic-team,2026-01-01 business');
      expect(downloadCSV).toHaveBeenLastCalledWith(expect.any(String), 'seats-page-1.csv');

      await wrapper.findAll('thead th').find(header => header.text() === 'Login')!.trigger('click');
      await action().trigger('click');
      expect(csv().split('\r\n').slice(1)).toEqual(displayedRows());
      expect(csv()).toContain('\r\n1,alpha,');

      await wrapper.find('button[aria-label="Go to page 2"]').trigger('click');
      expect(wrapper.emitted('page-change')).toEqual([[2]]);
      await wrapper.setProps({ currentPage: 2, seats: [seat('page-two-only', '2026-01-04')] });
      await flushPromises();
      await action().trigger('click');
      expect(csv().split('\r\n').slice(1)).toEqual(displayedRows());
      expect(csv()).toContain('\r\n3,page-two-only,');
      expect(csv()).not.toContain('alpha');
      expect(csv()).not.toContain('zulu');
      expect(downloadCSV).toHaveBeenLastCalledWith(expect.any(String), 'seats-page-2.csv');

      await wrapper.setProps({ seats: [] });
      await flushPromises();
      expect(action().attributes('disabled')).toBeDefined();
      expect(wrapper.text()).toContain('No permitted seats on this page to export.');
      vi.mocked(downloadCSV).mockClear();
      await action().trigger('click');
      expect(downloadCSV).not.toHaveBeenCalled();
    } finally { wrapper.unmount(); }
  });
});
