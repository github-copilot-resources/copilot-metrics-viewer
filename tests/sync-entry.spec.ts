/**
 * Integration tests for server/sync-entry.ts
 *
 * Verifies that the standalone sync job:
 *   - Can be imported without crashing (catches import-chain breakage like
 *     the original ERR_MODULE_NOT_FOUND from static mock JSON imports)
 *   - Calls syncBulk with the correct scope/identifier from env vars
 *   - Handles missing NUXT_GITHUB_TOKEN gracefully (exits with code 1)
 *   - Handles missing org/enterprise identifier gracefully (exits with code 1)
 *   - Calls initSchema and closePool on the database connection
 *   - Sets exitCode=1 when syncBulk throws
 *
 * All external dependencies (proxy-agent, sync-service, db) are mocked so
 * these tests run without a real GitHub token or PostgreSQL database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (hoisted by Vitest before imports) ─────────────────────────────────

// vi.mock() calls are hoisted to the top of the file. Any variables referenced
// inside their factory functions must also be hoisted via vi.hoisted().
const {
  mockInitializeProxyAgent,
  mockSyncBulk,
  mockInitSchema,
  mockClosePool,
} = vi.hoisted(() => ({
  mockInitializeProxyAgent: vi.fn().mockReturnValue(null),
  mockSyncBulk: vi.fn().mockResolvedValue({
    success: true,
    totalDays: 5,
    savedDays: 5,
    skippedDays: 0,
    errors: [],
  }),
  mockInitSchema: vi.fn().mockResolvedValue(undefined),
  mockClosePool: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../server/utils/proxy-agent', () => ({
  initializeProxyAgent: mockInitializeProxyAgent,
}));

vi.mock('../server/services/sync-service', () => ({
  syncBulk: mockSyncBulk,
}));

vi.mock('../server/storage/db', () => ({
  initSchema: mockInitSchema,
  closePool: mockClosePool,
}));

// Import runSync after mocks are registered
import { runSync } from '../server/sync-entry.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Snapshot the process env so we can restore it after each test. */
function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const saved = { ...process.env };
    try {
      // Clear then apply the provided env
      for (const key of Object.keys(process.env)) delete process.env[key];
      for (const [k, v] of Object.entries(env)) {
        if (v !== undefined) process.env[k] = v;
      }
      await fn();
    } finally {
      // Restore
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  };
}

const BASE_ENV = {
  NUXT_GITHUB_TOKEN: 'test-token-abc',
  NUXT_PUBLIC_GITHUB_ORG: 'test-org',
  NUXT_PUBLIC_SCOPE: 'organization',
  SYNC_DAYS_BACK: '7',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync-entry: module import', () => {
  it('can be imported without ERR_MODULE_NOT_FOUND (verifies import chain is intact)', () => {
    // If any static import in the transitive dependency chain is broken
    // (e.g. the original bug where github-copilot-usage-api-mock.ts tried to
    // statically import missing JSON files), importing this module would throw
    // an ERR_MODULE_NOT_FOUND error. Simply reaching this assertion is the test.
    expect(runSync).toBeTypeOf('function');
  });

  it('calls initializeProxyAgent with exitOnError=true at module load time', () => {
    // initializeProxyAgent is invoked at the top level of sync-entry.ts (before
    // runSync) so that the proxy is ready before any fetch call is made.
    // This verifies the call happened when the module was loaded.
    expect(mockInitializeProxyAgent).toHaveBeenCalledWith(true);
  });
});

describe('sync-entry: happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncBulk.mockResolvedValue({
      success: true,
      totalDays: 5,
      savedDays: 5,
      skippedDays: 0,
      errors: [],
    });
  });

  it('calls initSchema before syncing', withEnv(BASE_ENV, async () => {
    await runSync();
    expect(mockInitSchema).toHaveBeenCalledOnce();
  }));

  it('calls syncBulk with organisation scope from env', withEnv(BASE_ENV, async () => {
    await runSync();
    expect(mockSyncBulk).toHaveBeenCalledOnce();
    const [scope, identifier, _headers, _teamSlug, daysBack] = mockSyncBulk.mock.calls[0];
    expect(scope).toBe('organization');
    expect(identifier).toBe('test-org');
    expect(daysBack).toBe(7);
  }));

  it('calls syncBulk with enterprise scope when NUXT_PUBLIC_SCOPE=enterprise', withEnv({
    NUXT_GITHUB_TOKEN: 'test-token-abc',
    NUXT_PUBLIC_SCOPE: 'enterprise',
    NUXT_PUBLIC_GITHUB_ENT: 'test-ent',
  }, async () => {
    await runSync();
    const [scope, identifier] = mockSyncBulk.mock.calls[0];
    expect(scope).toBe('enterprise');
    expect(identifier).toBe('test-ent');
  }));

  it('normalises team-organization scope to organization', withEnv({
    ...BASE_ENV,
    NUXT_PUBLIC_SCOPE: 'team-organization',
  }, async () => {
    await runSync();
    const [scope] = mockSyncBulk.mock.calls[0];
    expect(scope).toBe('organization');
  }));

  it('normalises team-enterprise scope to enterprise', withEnv({
    NUXT_GITHUB_TOKEN: 'test-token-abc',
    NUXT_PUBLIC_SCOPE: 'team-enterprise',
    NUXT_PUBLIC_GITHUB_ENT: 'test-ent',
  }, async () => {
    await runSync();
    const [scope] = mockSyncBulk.mock.calls[0];
    expect(scope).toBe('enterprise');
  }));

  it('passes Authorization header containing the GitHub token to syncBulk', withEnv(BASE_ENV, async () => {
    await runSync();
    const [_scope, _identifier, headers] = mockSyncBulk.mock.calls[0] as [string, string, Record<string, string>];
    expect(headers['Authorization']).toContain('test-token-abc');
  }));

  it('always calls closePool in the finally block', withEnv(BASE_ENV, async () => {
    await runSync();
    expect(mockClosePool).toHaveBeenCalledOnce();
  }));

  it('does not set exitCode=1 on a clean run', withEnv(BASE_ENV, async () => {
    const previousExitCode = process.exitCode;
    try {
      process.exitCode = 0;
      await runSync();
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = previousExitCode;
    }
  }));
});

describe('sync-entry: missing env vars', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on process.exit to prevent the test process from actually exiting
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(
      (() => { throw new Error('process.exit called'); }) as () => never
    );
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('exits with code 1 when NUXT_GITHUB_TOKEN is not set', withEnv({
    NUXT_PUBLIC_GITHUB_ORG: 'test-org',
    NUXT_PUBLIC_SCOPE: 'organization',
  }, async () => {
    await expect(runSync()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockSyncBulk).not.toHaveBeenCalled();
  }));

  it('exits with code 1 when neither ORG nor ENT identifier is set', withEnv({
    NUXT_GITHUB_TOKEN: 'test-token-abc',
    NUXT_PUBLIC_SCOPE: 'organization',
  }, async () => {
    await expect(runSync()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockSyncBulk).not.toHaveBeenCalled();
  }));
});

describe('sync-entry: syncBulk failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets process.exitCode=1 when syncBulk throws', withEnv(BASE_ENV, async () => {
    mockSyncBulk.mockRejectedValue(new Error('GitHub API unavailable'));
    const previousExitCode = process.exitCode;
    try {
      process.exitCode = 0;
      await runSync();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  }));

  it('still calls closePool even when syncBulk throws', withEnv(BASE_ENV, async () => {
    mockSyncBulk.mockRejectedValue(new Error('GitHub API unavailable'));
    await runSync();
    expect(mockClosePool).toHaveBeenCalledOnce();
  }));

  it('still calls closePool when syncBulk returns partial errors', withEnv(BASE_ENV, async () => {
    mockSyncBulk.mockResolvedValue({
      success: false,
      totalDays: 3,
      savedDays: 2,
      skippedDays: 0,
      errors: [{ date: '2026-03-01', error: 'rate limited' }],
    });
    await runSync();
    expect(mockClosePool).toHaveBeenCalledOnce();
  }));
});
