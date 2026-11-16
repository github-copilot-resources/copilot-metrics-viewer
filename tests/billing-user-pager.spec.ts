// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { useBillingUserPage } from '../app/composables/useBillingUserPage';
import type { BillingUserPage } from '../shared/types/billing-user-page';

describe('billing page request isolation', () => {
  it('replaces pages and ignores late responses across scope, window and pagination changes', async () => {
    const requests: ((page: BillingUserPage) => void)[] = [];
    const fetch = vi.fn((_query: Record<string, string>) => new Promise<BillingUserPage>(resolve => requests.push(resolve)));
    const pager = useBillingUserPage(fetch);
    const options = { page: 2, itemsPerPage: 25, sortBy: [{ key: 'netAmount', order: 'desc' as const }] };
    const page = (user: string): BillingUserPage => ({
      available: true, total: 51, topTokenUsers: [], lastImportAt: null,
      window: { startDate: '2026-06-01', endDate: '2026-06-30' },
      rows: [{ user, tokens: 0, credits: 4, grossAmount: 4, netAmount: 4, models: 1 }],
    });
    const old = pager.load({ githubEnt: 'old', month: '6' }, options);
    const current = pager.load({ githubEnt: 'new', month: '7' }, options);
    requests[1]!(page('current'));
    await current;
    requests[0]!(page('stale'));
    await old;
    expect(pager.result.value?.rows.map(row => row.user)).toEqual(['current']);
    const next = pager.load({ githubEnt: 'new', month: '7' }, { ...options, page: 3 });
    expect(pager.result.value).toBeNull();
    expect(pager.available.value).toBe(true);
    requests[2]!(page('replacement'));
    await next;
    expect(pager.result.value?.rows.map(row => row.user)).toEqual(['replacement']);
    expect(fetch.mock.lastCall?.[0]).toMatchObject({ page: '3', sort: 'netAmount', order: 'desc' });
    const final = pager.load({ githubEnt: 'third' }, options);
    pager.invalidate();
    requests[3]!(page('unmounted'));
    await final;
    expect(pager.result.value).toBeNull();
  });
});
