// @vitest-environment node
/**
 * Seats fallback: central credential first, then (opt-in) the caller's own
 * GitHub OAuth token after a 401/403/404. Enterprise GitHub Apps cannot read
 * /enterprises/{ent}/copilot/billing/seats, so admins need this fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).getUserSession = vi.fn(async () => (globalThis as any).__test_session ?? {});
  (globalThis as any).$fetch = vi.fn();
  (globalThis as any).createError = (o: { statusCode: number; statusMessage: string; data?: unknown }) =>
    Object.assign(new Error(o.statusMessage), o);
});

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

import {
  createSeatsFetcher,
  seatsFetchError,
  isSeatsUserTokenEnabled,
  SEATS_NO_ACCESS_REASON,
} from '../server/utils/seats-token';

const event = {} as any;
const URL = 'https://api.github.com/enterprises/my-ent/copilot/billing/seats';
const appHeaders = new Headers({ Authorization: 'token ghs_app' });
const denied = (status: number) => Object.assign(new Error('denied'), { statusCode: status });
const fetchMock = () => (globalThis as any).$fetch as ReturnType<typeof vi.fn>;
const authOf = (call: any[]) => new Headers(call[1].headers).get('Authorization');

function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }
function setSession(s: unknown) { (globalThis as any).__test_session = s; }

beforeEach(() => {
  fetchMock().mockReset();
  setConfig({});
  setSession({});
});

describe('isSeatsUserTokenEnabled', () => {
  it.each([[true, true], ['true', true], [false, false], ['', false], [undefined, false]])('%j → %s', (v, e) => {
    expect(isSeatsUserTokenEnabled({ seatsUseUserToken: v })).toBe(e);
  });
});

describe('createSeatsFetcher', () => {
  it('uses only the central credential when the opt-in is off', async () => {
    setSession({ secure: { tokens: { access_token: 'gho_user' } } });
    fetchMock().mockRejectedValueOnce(denied(403));
    const { fetchSeats, state } = await createSeatsFetcher(event, appHeaders);
    await expect(fetchSeats(URL, { page: 1 })).rejects.toMatchObject({ statusCode: 403 });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(state.fallbackAvailable).toBe(false);
  });

  it('returns central data without touching the user token', async () => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_user' } } });
    fetchMock().mockResolvedValueOnce({ seats: [], total_seats: 0 });
    const { fetchSeats, state } = await createSeatsFetcher(event, appHeaders);
    await fetchSeats(URL, { page: 1 });
    expect(authOf(fetchMock().mock.calls[0]!)).toBe('token ghs_app');
    expect(state.usedUserToken).toBe(false);
  });

  it.each([401, 403, 404])('retries with the user token after %i and keeps it for later pages', async (status) => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_admin' } } });
    fetchMock()
      .mockRejectedValueOnce(denied(status))
      .mockResolvedValueOnce({ seats: [], total_seats: 150 })
      .mockResolvedValueOnce({ seats: [], total_seats: 150 });
    const { fetchSeats, state } = await createSeatsFetcher(event, appHeaders);
    await fetchSeats(URL, { page: 1 });
    await fetchSeats(URL, { page: 2 });
    const calls = fetchMock().mock.calls;
    expect(calls.map(authOf)).toEqual(['token ghs_app', 'token gho_admin', 'token gho_admin']);
    expect(state.usedUserToken).toBe(true);
  });

  it('does not retry on non-denial errors', async () => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_admin' } } });
    fetchMock().mockRejectedValueOnce(denied(502));
    const { fetchSeats } = await createSeatsFetcher(event, appHeaders);
    await expect(fetchSeats(URL, {})).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('propagates the user-token denial (caller without seat rights)', async () => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_dev' } } });
    fetchMock().mockRejectedValueOnce(denied(403)).mockRejectedValueOnce(denied(403));
    const { fetchSeats } = await createSeatsFetcher(event, appHeaders);
    await expect(fetchSeats(URL, {})).rejects.toMatchObject({ statusCode: 403 });
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('skips the fallback when the central credential already is the user token', async () => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_user' } } });
    fetchMock().mockRejectedValueOnce(denied(403));
    const { fetchSeats, state } = await createSeatsFetcher(event, new Headers({ Authorization: 'token gho_user' }));
    await expect(fetchSeats(URL, {})).rejects.toMatchObject({ statusCode: 403 });
    expect(state.fallbackAvailable).toBe(false);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('has no fallback without a GitHub session token or with an expired one', async () => {
    setConfig({ seatsUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_old' }, expires_at: '2000-01-01T00:00:00Z' } });
    const { state } = await createSeatsFetcher(event, appHeaders);
    expect(state.fallbackAvailable).toBe(false);
  });
});

describe('seatsFetchError', () => {
  it('tags denials with seats-no-access when the opt-in is on', () => {
    setConfig({ seatsUseUserToken: true });
    expect(seatsFetchError(denied(404), event)).toMatchObject({
      statusCode: 403,
      data: { reason: SEATS_NO_ACCESS_REASON },
    });
  });

  it('keeps the original status and no reason when the opt-in is off', () => {
    const err = seatsFetchError(denied(403), event) as any;
    expect(err.statusCode).toBe(403);
    expect(err.data).toBeUndefined();
  });

  it('keeps non-denial statuses untouched', () => {
    setConfig({ seatsUseUserToken: true });
    const err = seatsFetchError(denied(502), event) as any;
    expect(err.statusCode).toBe(502);
    expect(err.data).toBeUndefined();
  });
});
