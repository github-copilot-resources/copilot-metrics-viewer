import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

const { fetchTeamPrMetrics, getCachedTeamPrMetrics, fetchAllTeamMembers } = vi.hoisted(() => ({
  fetchTeamPrMetrics: vi.fn(),
  getCachedTeamPrMetrics: vi.fn(),
  fetchAllTeamMembers: vi.fn(),
}));

const runtimeConfig = {
  githubToken: 'test-token',
  githubApiBaseUrl: 'https://ghe.example/api/v3',
  apiBaseUrl: 'https://wrong.example/api/v3',
  app: { baseURL: '/' },
  public: { scope: 'organization', githubOrg: 'test-org' },
};

mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);

vi.mock('../server/utils/team-membership', () => ({
  requireTeamMembershipOrAdmin: vi.fn(),
}));

vi.mock('../server/api/seats', () => ({
  fetchAllTeamMembers,
}));

vi.mock('../server/services/team-pr-search', async importOriginal => ({
  ...await importOriginal<typeof import('../server/services/team-pr-search')>(),
  fetchTeamPrMetrics,
}));

vi.mock('../server/storage/team-pr-metrics-storage', () => ({
  getCachedTeamPrMetrics,
  saveTeamPrMetrics: vi.fn(),
}));

describe('team pull requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
    vi.stubGlobal('getQuery', () => ({
      githubTeam: 'team',
      since: '2026-03-01',
      until: '2026-03-28',
    }));
    getCachedTeamPrMetrics.mockResolvedValue(null);
    fetchAllTeamMembers.mockResolvedValue([{ login: 'alice' }]);
    fetchTeamPrMetrics.mockResolvedValue({ weeks: [] });
  });

  it('uses the configured GitHub API base URL for PR search', async () => {
    const handler = (await import('../server/api/team-pull-requests.get')).default;
    await handler({ context: { headers: new Headers({ Authorization: 'Bearer test-token' }) } } as never);

    expect(fetchTeamPrMetrics).toHaveBeenCalledWith(expect.objectContaining({
      apiBaseUrl: 'https://ghe.example/api/v3',
    }));
  });
});
