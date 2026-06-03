/**
 * Unit tests for server/utils/sync-auth.ts
 *
 * Verifies the authentication selection logic used by the standalone sync job:
 *   - GitHub App authentication is preferred when both PAT and App creds are set
 *   - Falls back to PAT when only PAT is configured
 *   - Throws a helpful error when no credentials are configured
 *   - Throws when GitHub App is configured but not installed on the target org
 *   - Propagates JWT signing errors with actionable messages
 *
 * `listAppInstallations` and the `ofetch` HTTP call inside
 * `getGitHubAppTokenForSync` are mocked so these tests run without network
 * access or a real GitHub App.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

const {
  mockListAppInstallations,
  mockOfetch,
} = vi.hoisted(() => {
  const mockListAppInstallations = vi.fn();
  const mockOfetch = vi.fn();
  // sync-auth.ts captures `$fetch` at module-load time (it falls back to ofetch
  // only when `$fetch` is undefined). The Nuxt test environment provides a real
  // `$fetch`, so we replace it with our mock *before* the import below — that
  // way the const inside sync-auth.ts is bound to our mock.
  (globalThis as { $fetch?: unknown }).$fetch = mockOfetch;
  return { mockListAppInstallations, mockOfetch };
});

vi.mock('../server/modules/github-app-auth', () => ({
  listAppInstallations: mockListAppInstallations,
}));

vi.mock('ofetch', () => ({
  $fetch: mockOfetch,
  ofetch: mockOfetch,
}));

import { getSyncAuthHeaders } from '../server/utils/sync-auth';

// A throw-away RSA private key, generated once per test run only for exercising
// the real JWT signing path. Not a credential for anything.
let TEST_RSA_PRIVATE_KEY = '';
beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  TEST_RSA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
});

const BASE_HEADERS = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
};

const ORIGINAL_ENV: Record<string, string | undefined> = {};
const MANAGED_VARS = [
  'NUXT_GITHUB_TOKEN',
  'NUXT_GITHUB_APP_ID',
  'NUXT_GITHUB_APP_PRIVATE_KEY',
  'NUXT_GITHUB_API_BASE_URL',
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const v of MANAGED_VARS) {
    ORIGINAL_ENV[v] = process.env[v];
    delete process.env[v];
  }
});

afterEach(() => {
  for (const v of MANAGED_VARS) {
    if (ORIGINAL_ENV[v] !== undefined) process.env[v] = ORIGINAL_ENV[v];
    else delete process.env[v];
  }
});

describe('getSyncAuthHeaders: auth mode selection', () => {
  it('prefers GitHub App when both PAT and App credentials are set', async () => {
    process.env.NUXT_GITHUB_TOKEN = 'ghp_pat_token';
    process.env.NUXT_GITHUB_APP_ID = '12345';
    process.env.NUXT_GITHUB_APP_PRIVATE_KEY = TEST_RSA_PRIVATE_KEY;

    mockListAppInstallations.mockResolvedValue([
      { id: 42, login: 'test-org', type: 'Organization' },
    ]);
    mockOfetch.mockResolvedValue({ token: 'ghs_app_install_token', expires_at: '2099-01-01T00:00:00Z' });

    const headers = await getSyncAuthHeaders(console, 'test-org');

    expect(mockListAppInstallations).toHaveBeenCalledWith('12345', TEST_RSA_PRIVATE_KEY);
    expect(headers.get('authorization')).toBe('Bearer ghs_app_install_token');
    expect(headers.get('accept')).toBe(BASE_HEADERS.accept);
    expect(headers.get('x-github-api-version')).toBe(BASE_HEADERS['x-github-api-version']);
  });

  it('falls back to PAT when only PAT is configured', async () => {
    process.env.NUXT_GITHUB_TOKEN = 'ghp_pat_token';

    const headers = await getSyncAuthHeaders(console, 'test-org');

    expect(mockListAppInstallations).not.toHaveBeenCalled();
    expect(mockOfetch).not.toHaveBeenCalled();
    expect(headers.get('authorization')).toBe('Bearer ghp_pat_token');
  });

  it('throws a helpful error when no credentials are configured', async () => {
    await expect(getSyncAuthHeaders(console, 'test-org'))
      .rejects.toThrow(/Authentication required.*NUXT_GITHUB_APP_ID.*NUXT_GITHUB_TOKEN/s);
    expect(mockListAppInstallations).not.toHaveBeenCalled();
  });

  it('matches installation case-insensitively', async () => {
    process.env.NUXT_GITHUB_APP_ID = '12345';
    process.env.NUXT_GITHUB_APP_PRIVATE_KEY = TEST_RSA_PRIVATE_KEY;

    mockListAppInstallations.mockResolvedValue([
      { id: 7, login: 'Test-Org', type: 'Organization' },
    ]);
    mockOfetch.mockResolvedValue({ token: 'ghs_case_match', expires_at: '2099-01-01T00:00:00Z' });

    const headers = await getSyncAuthHeaders(console, 'TEST-ORG');
    expect(headers.get('authorization')).toBe('Bearer ghs_case_match');
  });
});

describe('getSyncAuthHeaders: GitHub App error paths', () => {
  it('throws when GitHub App is configured but not installed on the target org', async () => {
    process.env.NUXT_GITHUB_APP_ID = '12345';
    process.env.NUXT_GITHUB_APP_PRIVATE_KEY = TEST_RSA_PRIVATE_KEY;

    mockListAppInstallations.mockResolvedValue([
      { id: 1, login: 'other-org', type: 'Organization' },
      { id: 2, login: 'another-org', type: 'Organization' },
    ]);

    await expect(getSyncAuthHeaders(console, 'test-org'))
      .rejects.toThrow(/GitHub App is not installed on org\/enterprise "test-org".*other-org.*another-org/s);
    expect(mockOfetch).not.toHaveBeenCalled();
  });

  it('propagates JWT signing errors with an actionable message', async () => {
    process.env.NUXT_GITHUB_APP_ID = '12345';
    // Invalid PEM: signing will fail inside buildAppJwt.
    process.env.NUXT_GITHUB_APP_PRIVATE_KEY = 'not-a-real-pem-key';

    mockListAppInstallations.mockResolvedValue([
      { id: 42, login: 'test-org', type: 'Organization' },
    ]);

    await expect(getSyncAuthHeaders(console, 'test-org'))
      .rejects.toThrow(/Failed to sign GitHub App JWT.*NUXT_GITHUB_APP_PRIVATE_KEY/s);
    expect(mockOfetch).not.toHaveBeenCalled();
  });

  it('honours NUXT_GITHUB_API_BASE_URL when requesting the installation token', async () => {
    process.env.NUXT_GITHUB_APP_ID = '12345';
    process.env.NUXT_GITHUB_APP_PRIVATE_KEY = TEST_RSA_PRIVATE_KEY;
    process.env.NUXT_GITHUB_API_BASE_URL = 'https://api.example-ghes.com';

    mockListAppInstallations.mockResolvedValue([
      { id: 99, login: 'test-org', type: 'Organization' },
    ]);
    mockOfetch.mockResolvedValue({ token: 'ghs_token', expires_at: '2099-01-01T00:00:00Z' });

    await getSyncAuthHeaders(console, 'test-org');

    expect(mockOfetch).toHaveBeenCalledOnce();
    const [calledUrl, calledOpts] = mockOfetch.mock.calls[0]!;
    expect(calledUrl).toBe('https://api.example-ghes.com/app/installations/99/access_tokens');
    expect(calledOpts).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    // JWT bearer token is sent for the installation-token call (not the install token itself).
    expect(calledOpts.headers.Authorization).toMatch(/^Bearer eyJ/);
  });
});
