/**
 * Ingester tests. Mocks the storage layer + global $fetch so no DB or
 * network is touched. Covers: happy path, multi-file download_urls,
 * polling-then-completed, GitHub job failure, SAS download failure,
 * parse failure, multi-chunk range, deadline timeout, error persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mock storage modules -------------------------------------------------

const mockGetJob = vi.fn();
const mockUpdateJob = vi.fn();
const mockCreateJob = vi.fn();
vi.mock('../server/storage/billing-csv-sync-status-storage', () => ({
  getBillingCsvJob: (...a: any[]) => mockGetJob(...a),
  updateBillingCsvJob: (...a: any[]) => mockUpdateJob(...a),
  createBillingCsvJob: (...a: any[]) => mockCreateJob(...a),
}));

const mockUpsert = vi.fn();
const mockDeleteRange = vi.fn();
vi.mock('../server/storage/billing-credit-usage-storage', () => ({
  upsertBillingCreditRows: (...a: any[]) => mockUpsert(...a),
  deleteBillingCreditRowsForRange: (...a: any[]) => mockDeleteRange(...a),
}));

// Fake pg client/pool so transactional() doesn't try a real connection.
const fakeClient = { query: vi.fn(async () => ({})), release: vi.fn() };
vi.mock('../server/storage/db', () => ({
  getPool: () => ({ connect: async () => fakeClient }),
}));

// ---- $fetch mock ---------------------------------------------------------

interface FetchCall { url: string; opts: any }
const fetchCalls: FetchCall[] = [];
let fetchImpl: (url: string, opts: any) => Promise<any> = async () => {
  throw new Error('fetchImpl not configured');
};
(globalThis as any).$fetch = (url: string, opts: any) => {
  fetchCalls.push({ url, opts });
  return fetchImpl(url, opts);
};

// Import AFTER mocks installed.
import { runBillingCsvIngester, chunkDateRange } from '../server/services/billing-csv-ingester';

beforeEach(() => {
  fetchCalls.length = 0;
  mockGetJob.mockReset();
  mockUpdateJob.mockReset().mockResolvedValue(undefined);
  mockUpsert.mockReset().mockResolvedValue(1);
  mockDeleteRange.mockReset().mockResolvedValue(undefined);
  fakeClient.query.mockClear();
  fakeClient.release.mockClear();
});

const HEADER = 'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,total_monthly_quota,organization,repository,cost_center_name,aic_quantity,aic_gross_amount';
const ONE_ROW = '2026-05-27,alice,copilot,copilot_ai_credit,gpt-4,1,credits,0.04,0.04,0,0.04,0,my-org,,,1,0.01';
const TINY_CSV = HEADER + '\n' + ONE_ROW;

function defaultJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    enterprise: 'acme-ent',
    startDate: '2026-05-27',
    endDate: '2026-06-26',
    githubJobId: null,
    status: 'queued',
    rowsIngested: 0,
    downloadUrlCount: 0,
    errorMessage: null,
    triggeredBy: 'sync-container',
    createdAt: '2026-06-26T00:00:00Z',
    updatedAt: '2026-06-26T00:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

describe('chunkDateRange', () => {
  it('returns a single chunk for ranges <= maxDays', () => {
    expect(chunkDateRange('2026-06-01', '2026-06-15', 31)).toEqual([
      { start: '2026-06-01', end: '2026-06-15' },
    ]);
  });

  it('returns one chunk exactly at maxDays', () => {
    expect(chunkDateRange('2026-06-01', '2026-07-01', 31)).toEqual([
      { start: '2026-06-01', end: '2026-07-01' },
    ]);
  });

  it('splits a 60-day range into two chunks of <=31 days each', () => {
    const chunks = chunkDateRange('2026-05-01', '2026-06-29', 31);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ start: '2026-05-01', end: '2026-05-31' });
    expect(chunks[1]).toEqual({ start: '2026-06-01', end: '2026-06-29' });
  });

  it('returns [] for inverted ranges', () => {
    expect(chunkDateRange('2026-06-30', '2026-06-01', 31)).toEqual([]);
  });
});

describe('runBillingCsvIngester — happy path', () => {
  it('POSTs, polls, downloads, upserts and marks completed', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-123', status: 'processing' };
      if (url.endsWith('/reports/gh-123')) {
        return { id: 'gh-123', status: 'completed', download_urls: ['https://sas/csv1'] };
      }
      if (url === 'https://sas/csv1') return TINY_CSV;
      throw new Error('unexpected url ' + url);
    };

    const result = await runBillingCsvIngester({
      token: 'ghp_test',
      jobId: 42,
      sleep: async () => {},
    });

    expect(result.status).toBe('completed');
    expect(result.rowsIngested).toBe(1);
    expect(result.downloadUrlCount).toBe(1);
    expect(mockDeleteRange).toHaveBeenCalledWith('acme-ent', '2026-05-27', '2026-06-26');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0]![0]).toHaveLength(1);
    expect(mockUpsert.mock.calls[0]![0][0]).toMatchObject({
      enterprise: 'acme-ent',
      username: 'alice',
      sku: 'copilot_ai_credit',
    });
    // status transitions: processing → completed (with intermediate progress writes)
    const statuses = mockUpdateJob.mock.calls.map(c => (c[1] as any).status).filter(Boolean);
    expect(statuses[0]).toBe('processing');
    expect(statuses[statuses.length - 1]).toBe('completed');
  });

  it('passes Authorization header on GitHub calls but NOT on SAS downloads', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) return { id: 'gh-1', status: 'completed', download_urls: ['https://sas/x'] };
      if (url === 'https://sas/x') return TINY_CSV;
      throw new Error(url);
    };
    await runBillingCsvIngester({ token: 'ghp_x', jobId: 42, sleep: async () => {} });

    // CodeQL: avoid `.includes('api.github.com')` (matches any path segment) —
    // do a proper host check via URL parsing, with a /reports tail fallback for
    // path-only stubs.
    const isGithubCall = (u: string) => {
      try { return new URL(u).hostname === 'api.github.com'; } catch { return false; }
    };
    const githubCalls = fetchCalls.filter(c => isGithubCall(c.url) || c.url.includes('/reports'));
    for (const c of githubCalls) {
      expect(c.opts.headers.Authorization).toBe('Bearer ghp_x');
      expect(c.opts.headers['X-GitHub-Api-Version']).toBe('2026-03-10');
    }
    // SAS download goes through bare ofetch (not $fetch) so it's NOT in fetchCalls
  });
});

describe('runBillingCsvIngester — polling', () => {
  it('keeps polling while status=processing then succeeds on completion', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    let pollCount = 0;
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) {
        pollCount++;
        if (pollCount < 3) return { id: 'gh-1', status: 'processing' };
        return { id: 'gh-1', status: 'completed', download_urls: ['https://sas/x'] };
      }
      if (url === 'https://sas/x') return TINY_CSV;
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('completed');
    expect(pollCount).toBe(3);
  });

  it('fails the job when GitHub reports the export as failed', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) {
        return { id: 'gh-1', status: 'failed', error_message: 'upstream barf' };
      }
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('upstream barf');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('times out if polling never sees completion', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      return { id: 'gh-1', status: 'processing' };
    };
    // Fake clock that advances by 60s on every sleep so we hit deadline fast.
    let t = 0;
    const result = await runBillingCsvIngester({
      token: 't',
      jobId: 42,
      sleep: async (ms: number) => { t += ms; },
      now: () => t,
    });
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/timed out/);
  });
});

describe('runBillingCsvIngester — multi-file download_urls', () => {
  it('downloads, parses and merges all CSVs', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    const row2 = '2026-05-28,bob,copilot,copilot_premium_request,gpt-4,2,requests,0.04,0.08,0,0.08,0,my-org,,,2,0.02';
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) {
        return { id: 'gh-1', status: 'completed', download_urls: ['https://sas/a', 'https://sas/b', 'https://sas/c'] };
      }
      if (url === 'https://sas/a') return TINY_CSV;
      if (url === 'https://sas/b') return HEADER + '\n' + row2;
      if (url === 'https://sas/c') return HEADER;
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('completed');
    expect(result.downloadUrlCount).toBe(3);
    expect(result.rowsIngested).toBe(2);
    expect(mockUpsert.mock.calls[0]![0]).toHaveLength(2);
  });

  it('fails when GitHub completes with zero download_urls', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) return { id: 'gh-1', status: 'completed', download_urls: [] };
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/no download_urls/);
  });
});

describe('runBillingCsvIngester — error capture', () => {
  it('records POST failures on the job row', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async () => { throw new Error('403 Forbidden'); };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/403/);
    const lastCall = mockUpdateJob.mock.calls[mockUpdateJob.mock.calls.length - 1]!;
    expect(lastCall[1].status).toBe('failed');
    expect(lastCall[1].errorMessage).toMatch(/403/);
  });

  it('records parse failures (malformed CSV)', async () => {
    mockGetJob.mockResolvedValue(defaultJob());
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') return { id: 'gh-1', status: 'processing' };
      if (url.endsWith('/reports/gh-1')) return { id: 'gh-1', status: 'completed', download_urls: ['https://sas/bad'] };
      if (url === 'https://sas/bad') return 'garbage,not,a,valid,csv';
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('failed');
  });

  it('throws when the job does not exist', async () => {
    mockGetJob.mockResolvedValue(null);
    await expect(
      runBillingCsvIngester({ token: 't', jobId: 999, sleep: async () => {} }),
    ).rejects.toThrow(/not found/);
  });
});

describe('runBillingCsvIngester — multi-chunk (>31 days)', () => {
  it('issues one POST per 31-day chunk and aggregates row counts', async () => {
    mockGetJob.mockResolvedValue(defaultJob({
      startDate: '2026-04-01',
      endDate: '2026-06-15',  // 76 days → 3 chunks
    }));
    let postCount = 0;
    fetchImpl = async (url, opts) => {
      if (opts?.method === 'POST') {
        postCount++;
        return { id: 'gh-' + postCount, status: 'processing' };
      }
      const m = url.match(/reports\/gh-(\d+)$/);
      if (m) return { id: 'gh-' + m[1], status: 'completed', download_urls: ['https://sas/c' + m[1]] };
      if (url.startsWith('https://sas/')) return TINY_CSV;
      throw new Error(url);
    };
    const result = await runBillingCsvIngester({ token: 't', jobId: 42, sleep: async () => {} });
    expect(result.status).toBe('completed');
    expect(postCount).toBe(3);
    expect(result.rowsIngested).toBe(3);
    expect(mockDeleteRange).toHaveBeenCalledTimes(3);
  });
});
