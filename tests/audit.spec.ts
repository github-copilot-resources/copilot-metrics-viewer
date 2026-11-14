// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).getUserSession = async () => (globalThis as any).__test_session || null;
  (globalThis as any).getRequestHeader = (event: any, name: string) => {
    const headers = event?._headers ?? {};
    return headers[name.toLowerCase()];
  };
});

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

import { emitAuditEvent } from '../server/utils/audit';

function setConfig(config: Record<string, unknown>) {
  (globalThis as any).__test_config = config;
}

function setSession(session: unknown) {
  (globalThis as any).__test_session = session;
}

function makeEvent(headers: Record<string, string> = {}) {
  return {
    _headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    node: { req: { socket: { remoteAddress: '10.0.0.1' } } },
    context: {},
  } as any;
}

describe('emitAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConfig({ auditLogEnabled: 'false' });
    setSession(null);
  });

  it('no-ops when audit logging is disabled', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await emitAuditEvent('auth.login.success', {
      action: 'login',
      outcome: 'allow',
    }, makeEvent());

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits single-line JSON with expected fields when enabled', async () => {
    setConfig({ auditLogEnabled: 'true' });
    setSession({ user: { login: 'alice', email: 'alice@example.com' } });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await emitAuditEvent('billing.viewed', {
      action: 'view',
      outcome: 'allow',
      target: 'octodemo',
      detail: { scope: 'organization', count: 3 },
    }, makeEvent({
      'x-forwarded-for': '203.0.113.10, 10.0.0.2',
      'user-agent': 'vitest',
      'x-request-id': 'req-123',
    }));

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({
      audit: true,
      event: 'billing.viewed',
      action: 'view',
      outcome: 'allow',
      actor: 'alice',
      sourceIp: '203.0.113.10',
      userAgent: 'vitest',
      requestId: 'req-123',
      target: 'octodemo',
      detail: { scope: 'organization', count: 3 },
    });
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    spy.mockRestore();
  });

  it('redacts sensitive detail fields', async () => {
    setConfig({ auditLogEnabled: 'true' });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await emitAuditEvent('admin.sync.triggered', {
      action: 'sync',
      outcome: 'allow',
      detail: {
        token: 'ghp_secret',
        clientSecret: 'secret',
        password: 'pw',
        cookieValue: 'cookie',
        safe: 'kept',
      },
    }, makeEvent({ authorization: 'token test' }));

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.actor).toBe('token-mode');
    expect(parsed.detail).toEqual({
      token: '[redacted]',
      clientSecret: '[redacted]',
      password: '[redacted]',
      cookieValue: '[redacted]',
      safe: 'kept',
    });
    spy.mockRestore();
  });
});
