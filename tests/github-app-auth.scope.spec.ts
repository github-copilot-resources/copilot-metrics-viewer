// @vitest-environment node
/**
 * Regression tests for getGitHubAppToken scope-aware identifier resolution.
 *
 * Bug: the resolver picked `githubOrg || githubEnt || configOrg || configEnt`
 * regardless of scope, so an enterprise-scoped request (e.g. the admin sync on
 * an enterprise deployment) could resolve a stray organization identifier and
 * fail with `GitHub App is not installed on org/enterprise "cody-test-org"`.
 *
 * Fix: prefer the identifier that matches the requested/deployment scope.
 */
import { generateKeyPairSync } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => {
  const fetch = vi.fn();
  (globalThis as any).$fetch = fetch;
  return fetch;
});

vi.mock('ofetch', () => ({ $fetch: mockFetch }));

vi.hoisted(() => {
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
});

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

function setQuery(q: Record<string, unknown>) { (globalThis as any).__test_query = q; }
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }

const PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const INSTALLATIONS = [
  { id: 1, account: { login: 'solteq-oyj', type: 'Enterprise' } },
  { id: 2, account: { login: 'cody-test-org', type: 'Organization' } },
];

/** Wire the $fetch mock to serve installation list + per-installation tokens. */
function wireFetch() {
  mockFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    if (url.includes('/app/installations?')) {
      return Promise.resolve(INSTALLATIONS);
    }
    if (url.includes('/access_tokens') && opts?.method === 'POST') {
      const id = Number(url.match(/installations\/(\d+)\/access_tokens/)![1]);
      return Promise.resolve({ token: `token-for-${id}`, expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

async function loadFresh() {
  vi.resetModules();
  return import('../server/modules/github-app-auth');
}

describe('getGitHubAppToken — scope-aware identifier resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setQuery({});
    wireFetch();
  });

  it('resolves the enterprise installation when deployment scope is enterprise (org unset)', async () => {
    setConfig({
      githubAppId: '12345',
      githubAppPrivateKey: PRIVATE_KEY,
      public: { scope: 'enterprise', githubOrg: '', githubEnt: 'solteq-oyj' },
    });
    const { getGitHubAppToken } = await loadFresh();
    const token = await getGitHubAppToken({} as never);
    expect(token).toBe('token-for-1'); // solteq-oyj, not cody-test-org
  });

  it('does not pick an org identifier over the enterprise when scope=enterprise', async () => {
    // Even if an org value leaks into config/query, enterprise scope wins.
    setConfig({
      githubAppId: '12345',
      githubAppPrivateKey: PRIVATE_KEY,
      public: { scope: 'enterprise', githubOrg: 'cody-test-org', githubEnt: 'solteq-oyj' },
    });
    const { getGitHubAppToken } = await loadFresh();
    const token = await getGitHubAppToken({} as never);
    expect(token).toBe('token-for-1'); // solteq-oyj
  });

  it('honours an explicit enterprise scope in the query string', async () => {
    setQuery({ scope: 'enterprise' });
    setConfig({
      githubAppId: '12345',
      githubAppPrivateKey: PRIVATE_KEY,
      public: { scope: 'organization', githubOrg: 'cody-test-org', githubEnt: 'solteq-oyj' },
    });
    const { getGitHubAppToken } = await loadFresh();
    const token = await getGitHubAppToken({} as never);
    expect(token).toBe('token-for-1'); // solteq-oyj
  });

  it('still resolves the organization installation when scope is organization', async () => {
    setQuery({ scope: 'organization', githubOrg: 'cody-test-org' });
    setConfig({
      githubAppId: '12345',
      githubAppPrivateKey: PRIVATE_KEY,
      public: { scope: 'enterprise', githubOrg: '', githubEnt: 'solteq-oyj' },
    });
    const { getGitHubAppToken } = await loadFresh();
    const token = await getGitHubAppToken({} as never);
    expect(token).toBe('token-for-2'); // cody-test-org
  });
});
