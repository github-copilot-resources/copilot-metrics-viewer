// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import BillingCreditsViewer from '../app/components/BillingCreditsViewer.vue';

const { useFetchMock } = vi.hoisted(() => ({ useFetchMock: vi.fn() }));
mockNuxtImport('useFetch', () => useFetchMock);

describe('billing cache scope isolation', () => {
  let wrapper: VueWrapper;
  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not carry the old scope roster into a request for a different scope', async () => {
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? [{ login: 'fake-old-user' }] : { usageItems: [] }),
      pending: ref(false), error: ref(null),
    }));
    const fetch = vi.fn().mockResolvedValue({ usageItems: [] });
    vi.stubGlobal('$fetch', fetch);
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
    vi.stubGlobal('$fetch', fetch);
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
});
