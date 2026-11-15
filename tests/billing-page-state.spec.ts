// @vitest-environment node
import { effectScope, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useBillingUserPage } from '../app/composables/useBillingUserPage';

const response = { rows: [{ user: 'synthetic', tokens: 10, credits: 2, grossAmount: 2, netAmount: 1, models: 1, billingState: 'loaded' as const }], total: 61, page: 1, itemsPerPage: 25, version: 'v1', billingSortAvailable: true };
describe('server billing page state', () => {
  it('deduplicates unchanged options and response changes; keeps count during paging and replaces rollups', async () => {
    const fetch = vi.fn().mockResolvedValue(response);
    const scope = effectScope();
    const state = scope.run(() => useBillingUserPage(ref({ scope: 'enterprise' }), fetch))!;
    try {
      await vi.waitFor(() => expect(state.result.value?.total).toBe(61));
      state.onTableOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
      await nextTick();
      expect(fetch).toHaveBeenCalledTimes(1);
      state.onTableOptions({ page: 2, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
      await nextTick();
      expect(state.total.value).toBe(61);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1]?.[0]).toMatchObject({ page: '2', version: 'v1' });
      expect(state.result.value?.rows[0]?.grossAmount).toBe(2);
      expect(fetch.mock.calls.flatMap(call => Object.keys(call[0]))).not.toContain('logins');
    } finally { scope.stop(); }
  });
  it('clears rows on error, preserves sort, and resets scope/window dependencies to page1', async () => {
    const query = ref({ scope: 'enterprise', usageSince: '2026-11-01' });
    const fetch = vi.fn().mockResolvedValue(response);
    const scope = effectScope();
    const state = scope.run(() => useBillingUserPage(query, fetch))!;
    try {
      await vi.waitFor(() => expect(state.result.value).not.toBeNull());
      fetch.mockRejectedValueOnce(new Error('synthetic failure'));
      state.onTableOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'netAmount', order: 'desc' }] });
      await vi.waitFor(() => expect(state.error.value).toContain('unavailable'));
      expect(state.result.value).toBeNull();
      expect(state.tableOptions.value.sortBy).toEqual([{ key: 'netAmount', order: 'desc' }]);
      state.retryBilling();
      await vi.waitFor(() => expect(state.result.value?.rows[0]?.netAmount).toBe(1));
      expect(fetch.mock.calls[2]?.[0]).toHaveProperty('version', 'v1');
      query.value = { scope: 'organization', usageSince: '2026-11-02' };
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
      expect(fetch.mock.calls[3]?.[0]).toMatchObject({ page: '1', scope: 'organization', usageSince: '2026-11-02' });
      expect(fetch.mock.calls[3]?.[0]).not.toHaveProperty('version');
    } finally { scope.stop(); }
  });
  it('restarts a changed publication once on page1 and aborts when its owner unmounts', async () => {
    const fetch = vi.fn().mockResolvedValue(response);
    const scope = effectScope();
    const state = scope.run(() => useBillingUserPage(ref({ scope: 'enterprise' }), fetch))!;
    try {
      await vi.waitFor(() => expect(state.result.value).not.toBeNull());
      fetch.mockRejectedValueOnce({ data: { data: { reason: 'dataset-changed' } } });
      state.onTableOptions({ page: 2, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
      expect(state.tableOptions.value.page).toBe(1);
      expect(fetch.mock.calls[2]?.[0]).not.toHaveProperty('version');
      expect(state.total.value).toBe(61);
      expect(state.error.value).toBe('');
    } finally { scope.stop(); }
    expect(fetch.mock.calls[2]?.[1].aborted).toBe(true);
  });
});
