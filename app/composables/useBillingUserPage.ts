import { ref, shallowRef } from 'vue';
import type { BillingUserPage } from '../../shared/types/billing-user-page';

export interface BillingPageOptions {
  page: number;
  itemsPerPage: number;
  sortBy: { key: string; order?: boolean | 'asc' | 'desc' }[];
}

export function useBillingUserPage(
  fetchPage: (query: Record<string, string>) => Promise<BillingUserPage> =
    query => $fetch<BillingUserPage>('/api/billing-user-page', { query }),
) {
  const result = shallowRef<Extract<BillingUserPage, { available: true }> | null>(null);
  const available = ref<boolean | null>(null);
  const pending = ref(false);
  const reason = ref('');
  const total = ref(0);
  let generation = 0;
  let dataset = '';
  let requestKey = '';

  async function load(query: Record<string, string>, options: BillingPageOptions): Promise<void> {
    const key = JSON.stringify(query);
    const sort = options.sortBy.find(sort => sort.order !== false);
    const request = {
      ...query, page: String(options.page), limit: String(options.itemsPerPage),
      sort: sort?.key ?? 'user', order: sort?.order === 'desc' ? 'desc' : 'asc',
    };
    const nextRequestKey = JSON.stringify(request);
    if (pending.value && requestKey === nextRequestKey) return;
    requestKey = nextRequestKey;
    const current = ++generation;
    if (dataset !== key) {
      available.value = null;
      total.value = 0;
      reason.value = '';
      dataset = key;
    }
    result.value = null;
    pending.value = true;
    try {
      const page = await fetchPage(request);
      if (current !== generation) return;
      available.value = page.available;
      if (page.available) {
        result.value = page;
        total.value = page.total;
        reason.value = '';
      } else {
        total.value = 0;
        reason.value = page.reason;
      }
    } catch {
      if (current !== generation) return;
      if (available.value !== true) {
        available.value = false;
        total.value = 0;
      }
      reason.value = 'Stored billing could not be loaded. Please retry.';
    } finally {
      if (current === generation) pending.value = false;
    }
  }
  function invalidate(): void {
    generation++;
    result.value = null;
    available.value = null;
    pending.value = false;
    requestKey = '';
  }
  return { result, available, pending, reason, total, load, invalidate };
}
