// @vitest-environment node
/**
 * listAppInstallations must recognise enterprise installations. GitHub returns
 * the enterprise account with `slug` (no `login`), so matching against
 * NUXT_PUBLIC_GITHUB_ENT failed (and `undefined.toLowerCase()` threw).
 */
import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

vi.hoisted(() => {
  (globalThis as any).$fetch = vi.fn();
});

import { listAppInstallations } from '../server/modules/github-app-auth';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

describe('listAppInstallations', () => {
  it('maps org, user and enterprise installations; skips accounts without identifier', async () => {
    const fetchMock = (globalThis as any).$fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce([
      { id: 1, account: { login: 'my-org', type: 'Organization' }, target_type: 'Organization' },
      { id: 2, account: { login: 'octocat', type: 'User' }, target_type: 'User' },
      { id: 3, account: { slug: 'css-ch-copilot-emu', name: 'CSS' }, target_type: 'Enterprise' },
      { id: 4, account: null, target_type: 'Enterprise' },
    ]);

    const list = await listAppInstallations('12345', pem);

    expect(list).toEqual([
      { id: 1, login: 'my-org', type: 'Organization' },
      { id: 2, login: 'octocat', type: 'User' },
      { id: 3, login: 'css-ch-copilot-emu', type: 'Enterprise' },
    ]);
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toMatch(/^Bearer /);
  });
});
