// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp, createError, defineEventHandler, getQuery, getHeader, setHeader, toNodeListener } from 'h3';
import type { AddressInfo } from 'node:net';
import type { UserTotals } from '../server/services/github-copilot-usage-api';

const fixtures = vi.hoisted(() => ({
  stored: false,
  seats: vi.fn(),
  users: vi.fn(),
  report: vi.fn(),
  days: vi.fn(),
}));
vi.mock('../server/storage/db-config', () => ({ isDbConfigured: () => fixtures.stored }));
vi.mock('../server/storage/db', () => ({ isDbConfigured: () => fixtures.stored }));
vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => ({ usageAdmins: 'synthetic-admin', public: { requireAuth: true } }),
}));
vi.mock('../server/storage/user-day-metrics-storage', () => ({ getUserDayMetricsByDateRange: vi.fn() }));
vi.mock('../server/storage/seats-storage', () => ({ getLatestSeats: fixtures.seats }));
vi.mock('../server/storage/user-metrics-storage', () => ({ getUserMetricsByDateRange: fixtures.users }));
vi.mock('../server/services/github-copilot-usage-api', async importOriginal => ({
  ...await importOriginal<typeof import('../server/services/github-copilot-usage-api')>(),
  fetchLatestUserReport: fixtures.report,
  fetchRawUserDayRecords: fixtures.days,
}));

const users: UserTotals[] = [
  { login: 'synthetic-self', user_id: 1, total_active_days: 9, user_initiated_interaction_count: 2,
    code_generation_activity_count: 10, code_acceptance_activity_count: 9,
    loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
  { login: 'synthetic-other', user_id: 2, total_active_days: 2, user_initiated_interaction_count: 1,
    code_generation_activity_count: 90, code_acceptance_activity_count: 9,
    loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
];
const rawSeats = [
  { assignee: { login: 'synthetic-self', id: 1 }, last_activity_at: null },
  { assignee: { login: 'synthetic-other', id: 2 }, last_activity_at: '2000-01-01T00:00:00Z' },
];
const upstream = vi.fn();
const membership = vi.fn();
let server: Server;
let base: string;

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', defineEventHandler);
  vi.stubGlobal('getQuery', getQuery);
  vi.stubGlobal('createError', createError);
  vi.stubGlobal('setHeader', setHeader);
  vi.stubGlobal('useRuntimeConfig', () => ({
    usageAdmins: 'synthetic-admin', public: { requireAuth: true },
  }));
  vi.stubGlobal('getUserSession', async (event: Parameters<typeof getHeader>[0]) => ({
    user: getHeader(event, 'x-test-login') ? { login: getHeader(event, 'x-test-login') } : undefined,
    secure: { tokens: { access_token: 'synthetic-test-only' } },
  }));
  vi.stubGlobal('$fetch', Object.assign(upstream, {
    raw: membership,
  }));
  const seatsRoute = (await import('../server/api/seats')).default;
  const usersRoute = (await import('../server/api/user-metrics')).default;
  const auth = (await import('../server/middleware/github')).default;
  const app = createApp();
  app.use(auth);
  app.use('/api/seats', seatsRoute);
  app.use('/api/user-metrics', usersRoute);
  server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.stored = false;
  upstream.mockResolvedValue({ seats: rawSeats, total_seats: 2 });
  membership.mockResolvedValue({ status: 404 });
  fixtures.report.mockResolvedValue({ user_totals: users });
});
const request = (path: string, login = 'synthetic-self') =>
  fetch(`${base}/api/${path}`, { headers: login ? { 'x-test-login': login } : {} });

describe('anonymous KPIs through real route, session and row boundaries', () => {
  it('keeps global user totals/weighted inputs identical while restricting another-user direct requests', async () => {
    for (const login of ['synthetic-self', 'synthetic-admin']) {
      const response = await request('user-metrics?scope=organization&githubOrg=synthetic-org&login=synthetic-other', login);
      expect(response.status).toBe(200);
      const rows = await response.json();
      expect(rows).toHaveLength(login === 'synthetic-self' ? 1 : 2);
      if (login === 'synthetic-self') expect(rows[0].login).toBe('synthetic-self');
      expect(JSON.parse(response.headers.get('x-copilot-user-summary') ?? 'null')).toEqual({
        total_users: 2, active_users: 1, generated: 100, accepted: 18,
      });
    }
  });
  it('separates global assigned count from self-only pagination and deduplicates before summarizing', async () => {
    upstream.mockResolvedValue({ seats: [...rawSeats, rawSeats[0]], total_seats: 3 });
    const response = await request('seats?scope=enterprise&githubEnt=synthetic-ent&per_page=1&page=2');
    const result = await response.json();
    expect(result.seats.map((s: { login: string }) => s.login)).toEqual(['synthetic-self']);
    expect(result.total_seats).toBe(1);
    expect(result.total_pages).toBe(1);
    expect(result.summary).toEqual({ assigned: 2, never_used: 1, inactive_7: 1, inactive_30: 1 });
    const admin = await (await request('seats?scope=enterprise&githubEnt=synthetic-ent&per_page=1&page=2', 'synthetic-admin')).json();
    expect(admin.summary).toEqual(result.summary);
    expect(admin.total_seats).toBe(2);
    expect(admin.total_pages).toBe(2);
    expect(admin.seats[0].login).toBe('synthetic-other');
  });
  it('uses the verified provider total on partial admin pages without fetching all pages or inventing activity totals', async () => {
    upstream.mockResolvedValue({ seats: rawSeats, total_seats: 901 });
    const response = await request('seats?scope=organization&githubOrg=synthetic-org&per_page=1', 'synthetic-admin');
    const result = await response.json();
    expect(result.summary).toEqual({ assigned: 901, never_used: null, inactive_7: null, inactive_30: null });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(result.total_pages).toBe(901);
  });
  it('rejects unauthenticated and nonmember team requests before loading aggregate data', async () => {
    for (const path of ['seats', 'user-metrics']) {
      expect((await request(`${path}?githubOrg=synthetic-org`, '')).status).toBe(401);
      expect((await request(`${path}?scope=organization&githubOrg=synthetic-org&githubTeam=private-team`)).status).toBe(403);
      expect((await request(`${path}?scope=enterprise&githubEnt=synthetic-ent&githubTeam=private-team`)).status).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
    expect(fixtures.report).not.toHaveBeenCalled();
    expect(fixtures.users).not.toHaveBeenCalled();
  });
  it('summarizes the already date/scoped storage result without another report fetch', async () => {
    fixtures.stored = true;
    fixtures.users.mockResolvedValue({ userTotals: users, reportStartDay: '2026-01-01', reportEndDay: '2026-01-09' });
    const response = await request('user-metrics?scope=organization&githubOrg=synthetic-org&since=2026-01-01&until=2026-01-09');
    expect(await response.json()).toHaveLength(1);
    expect(JSON.parse(response.headers.get('x-copilot-user-summary') ?? 'null')?.total_users).toBe(2);
    expect(fixtures.users).toHaveBeenCalledWith('organization', 'synthetic-org', '2026-01-01', '2026-01-09');
    expect(fixtures.report).not.toHaveBeenCalled();
  });
  it('filters an authorized team before summarizing and never includes other users in self-only rows', async () => {
    const members = [{ login: 'synthetic-self', id: 1 }, { login: 'synthetic-inactive', id: 3 }];
    upstream.mockResolvedValue(members);
    membership.mockResolvedValue({ status: 200, _data: { role: 'member', state: 'active' } });
    const response = await request('user-metrics?scope=organization&githubOrg=synthetic-org&githubTeam=synthetic-team');
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: UserTotals) => row.login)).toEqual(['synthetic-self']);
    expect(JSON.parse(response.headers.get('x-copilot-user-summary') ?? 'null')).toEqual({
      total_users: 2, active_users: 1, generated: 10, accepted: 9,
    });
  });
  it('does not fabricate a scope count from an invalid provider total', async () => {
    upstream.mockResolvedValue({ seats: rawSeats, total_seats: -1 });
    expect((await request('seats?scope=organization&githubOrg=synthetic-org', 'synthetic-admin')).status).toBe(500);
  });
});
