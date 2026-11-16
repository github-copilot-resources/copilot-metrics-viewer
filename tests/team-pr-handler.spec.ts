// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../server/utils/team-membership', () => ({ requireTeamMembershipOrAdmin: vi.fn() }));
vi.mock('../server/api/seats', () => ({ fetchAllTeamMembers: vi.fn(async () => [{ login: 'alice' }]) }));
vi.mock('../server/storage/team-pr-metrics-storage', () => ({
  getCachedTeamPrMetrics: vi.fn(async () => null), saveTeamPrMetrics: vi.fn(),
}));
vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useRuntimeConfig: () => ({
    public: {}, githubApiBaseUrl: 'https://api.example.ghe.com', githubToken: 'test-only',
  }),
}));

afterEach(() => vi.unstubAllGlobals());

it('sends PR search to the same configured GHE host as membership', async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
  vi.stubGlobal('getQuery', () => ({
    scope: 'organization', githubOrg: 'example', githubTeam: 'qa',
    isDataMocked: 'false', since: '2026-03-02', until: '2026-03-08',
  }));
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: {}, githubApiBaseUrl: 'https://api.example.ghe.com', githubToken: 'test-only',
  }));
  vi.stubGlobal('createError', (error: unknown) => error);
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} })));
  vi.stubGlobal('fetch', fetchMock);
  const { default: handler } = await import('../server/api/team-pull-requests.get');
  await handler({ context: { headers: new Headers() } } as never);
  expect(fetchMock).toHaveBeenCalledWith('https://api.example.ghe.com/graphql', expect.objectContaining({ method: 'POST' }));
});
