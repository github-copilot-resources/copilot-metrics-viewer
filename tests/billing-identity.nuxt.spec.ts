// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import BillingCreditsViewer from '../app/components/BillingCreditsViewer.vue';
import type { BillingUserPage } from '../shared/types/billing-user-page';

const { useFetchMock } = vi.hoisted(() => ({ useFetchMock: vi.fn() }));
mockNuxtImport('useFetch', () => useFetchMock);
const page = (user = 'synthetic-user', credits = 3): BillingUserPage => ({
  rows: [{ user, tokens: 10, credits, netAmount: 1, grossAmount: 2, models: 1, billingState: 'loaded' }],
  total: 61, page: 1, itemsPerPage: 25, version: 'v1', billingSortAvailable: true,
});
describe('billing snapshot page isolation', () => {
  let wrapper: VueWrapper;
  afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  async function mount(fetch: ReturnType<typeof vi.fn>) {
    useFetchMock.mockImplementation(async () => ({
      data: ref({ usageItems: [{ product: 'copilot', grossAmount: 1, netAmount: 1, netQuantity: 1 }] }),
      pending: ref(false), error: ref(null),
    }));
    vi.stubGlobal('$fetch', fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      props: { queryParams: { scope: 'enterprise', githubEnt: 'synthetic-old', since: '2026-11-01', until: '2026-11-13' } },
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, VDataTableServer: true, Bar: true } },
    });
    await flushPromises();
    return wrapper.vm as unknown as {
      onTableOptions: (options: { page: number; itemsPerPage: number; sortBy: { key: string; order: 'asc' | 'desc' }[] }) => void;
      perUserRows: BillingUserPage['rows']; perUserError: string; retryBilling: () => void; shiftMonth: (delta: number) => void;
    };
  }
  it('uses server-owned order, distinct usage window and compact requests, not a rich roster', async () => {
    const fetch = vi.fn().mockResolvedValue(page());
    const vm = await mount(fetch);
    vm.onTableOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'netAmount', order: 'desc' }] });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]).toMatchObject(['/api/billing-user-page', {
      query: { usageSince: '2026-11-01', usageUntil: '2026-11-13', sortKey: 'netAmount', sortOrder: 'desc', page: '1' },
    }]);
    expect(vm.perUserRows).toEqual(page().rows);
    expect(useFetchMock.mock.calls.some(call => call[0] === '/api/user-metrics')).toBe(false);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain('logins');
  });
  it('replaces values on retry and never represents failed rows as zeros', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error('synthetic unavailable')).mockResolvedValueOnce(page());
    const vm = await mount(fetch);
    vm.onTableOptions({ page: 2, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
    await flushPromises();
    expect(vm.perUserRows).toEqual([]);
    expect(vm.perUserError).toContain('unavailable');
    vm.retryBilling();
    await flushPromises();
    expect(vm.perUserRows[0]?.credits).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('ignores stale responses after a scope switch and excludes the old dataset version', async () => {
    let resolveOld!: (value: BillingUserPage) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(page('synthetic-new', 5));
    const vm = await mount(fetch);
    await wrapper.setProps({ queryParams: { scope: 'organization', githubOrg: 'synthetic-new', since: '2026-11-02', until: '2026-11-13' } });
    await flushPromises();
    resolveOld(page('synthetic-old', 999));
    await flushPromises();
    expect(vm.perUserRows).toMatchObject([{ user: 'synthetic-new', credits: 5 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1].query).not.toHaveProperty('version');
  });
});
