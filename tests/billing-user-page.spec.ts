// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../server/api/billing-user-page.get';
const mocks = vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
  vi.stubGlobal('createError', (input: { statusCode: number; statusMessage?: string; data?: unknown }) => Object.assign(new Error(input.statusMessage), input));
  return { query: {} as Record<string, string>, read: vi.fn(), gate: vi.fn(), team: vi.fn() };
});
vi.mock('#app/nuxt', () => ({ useRuntimeConfig: () => ({ billingEnterprise: 'synthetic-enterprise' }) }));
vi.mock('../server/storage/db', () => ({ getPool: vi.fn() }));
vi.mock('../server/utils/usage-admin', () => ({ requireUsageAdmin: mocks.gate }));
vi.mock('../server/utils/team-membership', () => ({ requireTeamMembershipOrAdmin: mocks.team }));
vi.mock('../server/services/billing-user-page', async original => ({
  ...await original<typeof import('../server/services/billing-user-page')>(), readBillingUserPage: mocks.read,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gate.mockResolvedValue(undefined);
  mocks.team.mockResolvedValue(undefined);
  mocks.query = { scope: 'organization', githubOrg: 'synthetic-org', usageSince: '2026-11-01', usageUntil: '2026-11-13', year: '2026', month: '11' };
  vi.stubGlobal('getQuery', () => mocks.query);
  vi.stubGlobal('useRuntimeConfig', () => ({ billingEnterprise: 'synthetic-enterprise' }));
});
describe('billing snapshot page authorization and contract', () => {
  it('rejects unauthorized/self-only callers before touching any roster or billing data', async () => {
    mocks.gate.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.team).not.toHaveBeenCalled();
  });
  it('preserves the team gate before reading; client usernames never establish authorization', async () => {
    mocks.query.githubTeam = 'synthetic-team';
    mocks.team.mockRejectedValueOnce(Object.assign(new Error('Forbidden team'), { statusCode: 403 }));
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.query.logins = 'synthetic-outsider';
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{ itemsPerPage: '51' }, { page: '1.5' }, { sortKey: 'unsafe SQL' }, { users: 'client-list' }, { cost_center_id: 'unsupported-id' }, { search: 'unsupported' }])('rejects unsupported/unbounded input: %j', async invalid => {
    Object.assign(mocks.query, invalid);
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('keeps usage dates distinct from the billing month and forwards exact scope/filter/version', async () => {
    Object.assign(mocks.query, { githubTeam: 'synthetic-team', model: 'synthetic-model', repository: 'synthetic-repo', version: 'v1', page: '2' });
    mocks.read.mockResolvedValueOnce({ rows: [], total: 0 });
    await handler({} as never);
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'organization', identifier: 'synthetic-org', team: 'synthetic-team',
      usageSince: '2026-11-01', usageUntil: '2026-11-13', billingSince: '2026-11-01', billingUntil: '2026-11-30',
      version: 'v1', page: 2, filters: expect.objectContaining({ model: 'synthetic-model', repository: 'synthetic-repo' }),
    }));
  });
});
