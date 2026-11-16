// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import BillingCreditsViewer from '../app/components/BillingCreditsViewer.vue';

const { useFetchMock } = vi.hoisted(() => ({ useFetchMock: vi.fn() }));
mockNuxtImport('useFetch', () => useFetchMock);

function stubLiveBilling(fetch: (url: string, options: unknown) => unknown) {
  vi.stubGlobal('$fetch', (url: string, options: unknown) => url === '/api/billing-user-page'
    ? Promise.resolve({ available: false, reason: 'Import billing to enable billing sorting.' }) : fetch(url, options));
}

describe('billing cache scope isolation', () => {
  let wrapper: VueWrapper;
  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('disables billing sorts without stored data, retaining bounded alphabetical pages', async () => {
    const users = Array.from({ length: 60 }, (_, i) => ({ login: `fake-user-${String(i).padStart(3, '0')}` }));
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? [...users].reverse() : { usageItems: [] }),
      pending: ref(false), error: ref(null),
    }));
    const fetch = vi.fn().mockImplementation((_url, { query }) => Promise.resolve({
      usageItems: query.logins.split(',').map((user: string) => ({
        user, netQuantity: 100 - users.findIndex(u => u.login === user), grossAmount: 1, netAmount: 1,
      })),
    }));
    stubLiveBilling(fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, VDataTableServer: true, Bar: true } },
    });
    const vm = wrapper.vm as unknown as {
      onTableOptions: (options: { page: number; itemsPerPage: number; sortBy: { key: string; order: 'asc' | 'desc' }[] }) => void;
      perUserPageRows: { user: string; credits: number | null }[];
      perUserRows: { user: string; credits: number | null }[];
      perUserHeaders: { key: string; sortable: boolean }[];
    };
    vm.onTableOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
    await flushPromises();
    vm.onTableOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'credits', order: 'asc' }] });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vm.perUserPageRows[0]).toMatchObject({ user: users[0]!.login, credits: 100 });
    expect(vm.perUserRows.find(row => row.user === users[59]!.login)?.credits).toBeNull();
    expect(vm.perUserHeaders.find(header => header.key === 'credits')?.sortable).toBe(false);
    vm.onTableOptions({ page: 2, itemsPerPage: 25, sortBy: [{ key: 'credits', order: 'desc' }] });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vm.perUserPageRows[0]).toMatchObject({ user: users[25]!.login, credits: 75 });
  });

  it('keeps global metric sorts, in-flight deduplication, and unknown/error/zero distinct through retry', async () => {
    const users = Array.from({ length: 60 }, (_, i) => ({
      login: `fake-user-${String(i).padStart(3, '0')}`,
      totals_by_cli: { token_usage: { prompt_tokens_sum: i, output_tokens_sum: 0 } },
    }));
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? users : { usageItems: [] }),
      pending: ref(false), error: ref(null),
    }));
    let resolveFirst!: (value: object) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockRejectedValueOnce(new Error('synthetic unavailable'))
      .mockResolvedValueOnce({ usageItems: [{ user: users[59]!.login, netQuantity: 17 }] });
    stubLiveBilling(fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, VDataTableServer: true, Bar: true } },
    });
    const vm = wrapper.vm as unknown as {
      onTableOptions: (options: { page: number; itemsPerPage: number; sortBy: { key: string; order: 'asc' | 'desc' }[] }) => void;
      retryBilling: () => void;
      perUserLoading: boolean;
      perUserPageRows: { user: string; billingState: string; credits: number | null }[];
      perUserRows: { user: string; billingState: string; credits: number | null }[];
    };
    const firstPage = { page: 1, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' as const }] };
    vm.onTableOptions(firstPage);
    vm.onTableOptions(firstPage);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vm.perUserLoading).toBe(true);
    expect(vm.perUserPageRows[0]).toMatchObject({ billingState: 'Loading', credits: null });
    resolveFirst({ usageItems: [] });
    await flushPromises();
    expect(vm.perUserPageRows[0]).toMatchObject({ billingState: 'loaded', credits: 0 });
    vm.onTableOptions({ ...firstPage, sortBy: [{ key: 'tokens', order: 'desc' }] });
    await flushPromises();
    expect(fetch.mock.calls[1]![1].query.logins.split(',')).toEqual(users.slice(35).reverse().map(u => u.login));
    expect(vm.perUserPageRows[0]).toMatchObject({ user: users[59]!.login, billingState: 'Unavailable', credits: null });
    vm.retryBilling();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vm.perUserPageRows[0]).toMatchObject({ user: users[59]!.login, billingState: 'loaded', credits: 17 });
    expect(vm.perUserLoading).toBe(false);
    expect(vm.perUserRows[30]).toMatchObject({ billingState: 'Not loaded', credits: null });
    vm.onTableOptions({ ...firstPage, sortBy: [{ key: 'user', order: 'desc' }] });
    await flushPromises();
    expect(vm.perUserPageRows[0]!.user).toBe(users[59]!.login);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not carry the old scope roster into a request for a different scope', async () => {
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? [{ login: 'fake-old-user' }] : { usageItems: [] }),
      pending: ref(false), error: ref(null),
    }));
    const fetch = vi.fn().mockResolvedValue({ usageItems: [] });
    stubLiveBilling(fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      props: { queryParams: { scope: 'enterprise', githubEnt: 'fake-old-ent' } },
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, Bar: true } },
    });
    const vm = wrapper.vm as unknown as { onTableOptions: (options: { page: number; itemsPerPage: number }) => void };
    vm.onTableOptions({ page: 1, itemsPerPage: 25 });
    await flushPromises();
    fetch.mockClear();
    await wrapper.setProps({ queryParams: { scope: 'enterprise', githubEnt: 'fake-new-ent' } });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores a previous window response and never caches unsolicited returned users', async () => {
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? [{ login: 'fake-user' }] : { usageItems: [] }),
      pending: ref(false), error: ref(null),
    }));
    let resolveOld!: (value: object) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ usageItems: [{ user: 'fake-user', grossQuantity: 3, netQuantity: 3, grossAmount: 0.3, netAmount: 0.3 }] });
    stubLiveBilling(fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      props: { queryParams: { scope: 'enterprise', githubEnt: 'fake-ent' } },
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, Bar: true } },
    });
    const vm = wrapper.vm as unknown as {
      onTableOptions: (options: { page: number; itemsPerPage: number }) => void;
      shiftMonth: (delta: number) => void;
      perUserRows: { user: string; credits: number }[];
    };
    vm.onTableOptions({ page: 1, itemsPerPage: 25 });
    vm.shiftMonth(-1);
    await flushPromises();
    resolveOld({ usageItems: [{ user: 'fake-user', netQuantity: 999 }, { user: 'fake-outsider', netQuantity: 777 }] });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vm.perUserRows).toMatchObject([{ user: 'fake-user', credits: 3 }]);
  });

  it('uses the database page as-is with its count and sort intent, without loading the complete roster or billing fanout', async () => {
    const execute = vi.fn();
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? null : { usageItems: [] }),
      execute, pending: ref(false), error: ref(null),
    }));
    const fetch = vi.fn().mockImplementation((_url, { query }) => Promise.resolve({
      available: true, total: 57, window: { startDate: '2026-06-01', endDate: '2026-06-30' },
      lastImportAt: '2026-07-01T10:00:00Z', topTokenUsers: [],
      rows: [{ user: query.page === '2' ? 'later-big-spender' : 'alpha', credits: query.page === '2' ? 16 : null, grossAmount: 16, netAmount: 16, models: 2, tokens: 9 }],
    }));
    vi.stubGlobal('$fetch', fetch);
    wrapper = await mountSuspended(BillingCreditsViewer, {
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, VDataTable: true, VDataTableServer: true, Bar: true } },
    });
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      onTableOptions: (options: { page: number; itemsPerPage: number; sortBy: { key: string; order: 'desc' }[] }) => void;
      perUserPageRows: { user: string; credits: number | null; billingState: string }[];
      perUserTotal: number;
      tableOptions: { page: number; sortBy: { key: string }[] };
    };
    expect(vm.perUserPageRows[0]).toMatchObject({ credits: null, billingState: 'No stored billing data' });
    vm.onTableOptions({ page: 2, itemsPerPage: 25, sortBy: [{ key: 'netAmount', order: 'desc' }] });
    await flushPromises();
    expect(vm.perUserPageRows.map(row => row.user)).toEqual(['later-big-spender']);
    expect(vm.perUserTotal).toBe(57);
    expect(vm.tableOptions).toMatchObject({ page: 2, sortBy: [{ key: 'netAmount' }] });
    expect(execute).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([url]) => url === '/api/billing-user-page')).toBe(true);
    expect(fetch.mock.lastCall?.[1].query).toMatchObject({ page: '2', sort: 'netAmount', order: 'desc', limit: '25' });
    expect(useFetchMock.mock.calls.find(([url]) => url === '/api/user-metrics')?.[1]).toMatchObject({ immediate: false });
    expect(wrapper.text()).toContain('Last successful billing import:');
  });
});
