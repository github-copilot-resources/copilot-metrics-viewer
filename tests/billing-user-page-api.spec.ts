// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../server/api/billing-user-page.get';
import billingProbe from '../server/api/auth/usage-admin.get';

const mocks = vi.hoisted(() => {
  const state = {
    query: {} as Record<string, string>,
    requireAdmin: vi.fn(), requireTeam: vi.fn(), page: vi.fn(), membership: vi.fn(), isAdmin: vi.fn(),
    configured: true,
    config: { billingEnterprise: 'synthetic-ent', githubBillingToken: '', public: { isDataMocked: false } },
  };
  Object.assign(globalThis, {
    defineEventHandler: (handler: unknown) => handler,
    getQuery: () => state.query,
    useRuntimeConfig: () => state.config,
    createError: (input: { statusCode: number; statusMessage: string }) => Object.assign(new Error(input.statusMessage), input),
  });
  return state;
});
vi.mock('../server/utils/usage-admin', () => ({ requireUsageAdmin: mocks.requireAdmin, isUsageAdminForEvent: mocks.isAdmin }));
vi.mock('../server/utils/team-membership', () => ({ requireTeamMembershipOrAdmin: mocks.requireTeam }));
vi.mock('../server/storage/db', () => ({ isDbConfigured: () => mocks.configured }));
vi.mock('../server/storage/db-config', () => ({ isDbConfigured: () => mocks.configured }));
vi.mock('../server/storage/roster-foundation-storage', () => ({ getMembershipSnapshot: mocks.membership }));
vi.mock('../server/services/billing-user-page', () => ({ getStoredBillingUserPage: mocks.page }));
vi.mock('#app/nuxt', () => ({ useRuntimeConfig: () => mocks.config }));

describe('stored billing page API scope boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.configured = true;
    mocks.query = {
      scope: 'organization', githubOrg: 'synthetic-org', githubTeam: 'synthetic-team',
      isDataMocked: 'false', year: '2026', month: '6', usageSince: '2026-05-01', usageUntil: '2026-05-15',
      page: '2', limit: '25', sort: 'netAmount', order: 'desc',
    };
    mocks.membership.mockResolvedValue({ available: true, version: 'permitted' });
    mocks.page.mockResolvedValue({ available: false, reason: 'No stored billing' });
  });
  const call = () => handler({ context: {} } as Parameters<typeof handler>[0]);

  it('makes stored billing reachable without a live credential while preserving the admin decision', async () => {
    mocks.isAdmin.mockResolvedValue(false);
    const event = { context: {} } as Parameters<typeof billingProbe>[0];
    expect(await billingProbe(event)).toMatchObject({ billingEnabled: true, isUsageAdmin: false });
    mocks.configured = false;
    expect(await billingProbe(event)).toMatchObject({ billingEnabled: false, isUsageAdmin: false });
  });

  it('enforces the billing admin gate before any storage access', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Forbidden'));
    await expect(call()).rejects.toThrow('Forbidden');
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.page).not.toHaveBeenCalled();
  });
  it('passes only the server-resolved team publication and independent billing/usage windows', async () => {
    await call();
    expect(mocks.requireTeam).toHaveBeenCalled();
    expect(mocks.membership).toHaveBeenCalledWith({
      scope: 'organization', identifier: 'synthetic-org', teamKind: 'github', teamKey: 'synthetic-team', githubOrg: undefined,
    }, expect.any(Date));
    expect(mocks.page).toHaveBeenCalledWith(expect.objectContaining({
      enterprise: 'synthetic-ent', identifier: 'synthetic-org', membershipVersion: 'permitted',
      window: expect.objectContaining({ startDate: '2026-06-01', endDate: '2026-06-30' }),
      usageSince: '2026-05-01', usageUntil: '2026-05-15', sort: 'netAmount', page: 2, limit: 25,
    }));
  });
  it('never retries unavailable team membership as an unrestricted enterprise query', async () => {
    mocks.membership.mockResolvedValue({ available: false });
    expect(await call()).toMatchObject({ available: false });
    expect(mocks.page).not.toHaveBeenCalled();
    mocks.query.githubTeam = 'reports-to:synthetic';
    expect(await call()).toMatchObject({ available: false });
    expect(mocks.page).not.toHaveBeenCalled();
  });
  it.each([{ sort: 'netAmount DESC; --' }, { limit: '500' }, { page: '-1' }])('rejects invalid table options %j', async invalid => {
    Object.assign(mocks.query, invalid);
    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.page).not.toHaveBeenCalled();
  });
});
