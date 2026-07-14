export interface PerUserBillingLazyRow {
  user: string;
  credits: number;
  grossAmount: number;
  netAmount: number;
  tokens: number;
  models: number;
}

export interface BillingTableOptions {
  page: number;
  itemsPerPage: number;
  sortBy?: { key: string; order?: string | boolean }[];
}

export interface BillingLazyLoadRequest {
  logins: string[];
  query: Record<string, string>;
  serverSorted: boolean;
}

const SORT_KEYS = new Set(['user', 'credits', 'tokens', 'grossAmount', 'netAmount', 'models']);
const SERVER_SORT_KEYS = new Set(['credits', 'grossAmount', 'netAmount', 'models']);

export function buildPerUserBillingLazyLoadRequest(
  rows: PerUserBillingLazyRow[],
  opts: BillingTableOptions,
): BillingLazyLoadRequest {
  const sort = normalizeSort(opts.sortBy);
  const page = Math.max(1, Number(opts.page) || 1);
  const itemsPerPage = Math.max(1, Number(opts.itemsPerPage) || 25);
  const query = {
    page: String(page),
    itemsPerPage: String(itemsPerPage),
    sortKey: sort.key,
    sortOrder: sort.order,
  };

  if (SERVER_SORT_KEYS.has(sort.key)) {
    return {
      logins: rows.map(r => r.user).filter(Boolean),
      query,
      serverSorted: true,
    };
  }

  const start = (page - 1) * itemsPerPage;
  const sortedRows = sortRows(rows, sort);
  return {
    logins: sortedRows.slice(start, start + itemsPerPage).map(r => r.user).filter(Boolean),
    query,
    serverSorted: false,
  };
}

function normalizeSort(sortBy: BillingTableOptions['sortBy']): { key: string; order: 'asc' | 'desc' } {
  const first = sortBy?.[0];
  const key = first && SORT_KEYS.has(first.key) ? first.key : 'user';
  const order = first?.order === 'desc' || first?.order === false ? 'desc' : 'asc';
  return { key, order };
}

function sortRows(
  rows: PerUserBillingLazyRow[],
  sort: { key: string; order: 'asc' | 'desc' },
): PerUserBillingLazyRow[] {
  const direction = sort.order === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sort.key as keyof PerUserBillingLazyRow];
    const bv = b[sort.key as keyof PerUserBillingLazyRow];
    const cmp = typeof av === 'string' || typeof bv === 'string'
      ? String(av).localeCompare(String(bv))
      : Number(av) - Number(bv);
    if (cmp !== 0) return cmp * direction;
    return a.user.localeCompare(b.user);
  });
}
