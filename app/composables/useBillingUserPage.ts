import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import type { BillingUserPage, BillingUserSort } from '../../shared/types/billing-user-page';

export interface BillingPageTableOptions {
  page: number;
  itemsPerPage: number;
  sortBy: { key: string; order?: boolean | 'asc' | 'desc' }[];
}

export function useBillingUserPage(
  query: Ref<Record<string, string>>,
  fetchPage: (query: Record<string, string>, signal: AbortSignal) => Promise<BillingUserPage>,
) {
  const tableOptions = ref<BillingPageTableOptions>({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'user', order: 'asc' }] });
  const result = ref<BillingUserPage | null>(null);
  const total = ref(0);
  const loading = ref(false);
  const error = ref('');
  const retry = ref(0);
  let version = '';
  let controller: AbortController | undefined;
  let generation = 0;
  const queryKey = computed(() => JSON.stringify(Object.entries(query.value).sort(([a], [b]) => a.localeCompare(b))));
  watch(queryKey, () => {
    generation++;
    controller?.abort();
    version = '';
    result.value = null;
    total.value = 0;
    tableOptions.value = { ...tableOptions.value, page: 1 };
  }, { flush: 'sync' });
  const request = computed(() => {
    const sort = tableOptions.value.sortBy.find(sort => sort.order !== false);
    return {
      ...query.value, page: String(tableOptions.value.page), itemsPerPage: String(tableOptions.value.itemsPerPage),
      sortKey: (sort?.key ?? 'user') as BillingUserSort, sortOrder: sort?.order === 'desc' ? 'desc' : 'asc',
    };
  });
  watch(() => JSON.stringify([request.value, retry.value]), async () => {
    controller?.abort();
    controller = new AbortController();
    const current = ++generation;
    loading.value = true;
    error.value = '';
    result.value = null;
    try {
      const response = await fetchPage({ ...request.value, ...(version ? { version } : {}) }, controller.signal);
      if (current !== generation) return;
      version = response.version;
      result.value = response;
      total.value = response.total;
    } catch (failure) {
      if (current !== generation) return;
      const reason = (failure as { data?: { data?: { reason?: string } } })?.data?.data?.reason;
      if (reason === 'dataset-changed') {
        version = '';
        total.value = 0;
        tableOptions.value = { ...tableOptions.value, page: 1 };
        // A single explicit retry also handles a publication change on page1.
        error.value = 'Dataset changed. Retry to load the new snapshot from page 1.';
      } else {
        error.value = reason || 'Per-user billing is unavailable, not zero. Check snapshot ingestion and billing aliases, then retry.';
      }
    } finally { if (current === generation) loading.value = false; }
  }, { immediate: true });
  onScopeDispose(() => { generation++; controller?.abort(); });
  function onTableOptions(options: Omit<BillingPageTableOptions, 'sortBy'> & { sortBy?: BillingPageTableOptions['sortBy'] }) {
    const sortBy = options.sortBy ?? [];
    const reset = options.itemsPerPage !== tableOptions.value.itemsPerPage
      || JSON.stringify(sortBy) !== JSON.stringify(tableOptions.value.sortBy);
    tableOptions.value = {
      page: reset ? 1 : Math.max(1, options.page),
      itemsPerPage: [10, 25, 50].includes(options.itemsPerPage) ? options.itemsPerPage : 25, sortBy,
    };
  }
  return { tableOptions, result, total, loading, error, onTableOptions, retryBilling: () => { retry.value++; } };
}
