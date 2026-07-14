import type { EventHandlerRequest, H3Event } from 'h3';

export interface AuditEventDetails {
  action: string;
  outcome: 'allow' | 'deny';
  target?: string;
  detail?: Record<string, unknown>;
}

const SENSITIVE_DETAIL_KEY = /token|secret|password|cookie/i;

export async function emitAuditEvent(
  eventName: string,
  details: AuditEventDetails,
  event?: H3Event<EventHandlerRequest>
): Promise<void> {
  try {
    const config = useRuntimeConfig(event);
    if (((config.auditLogEnabled as string | undefined) ?? 'false') !== 'true') {
      return;
    }

    const actor = await resolveActor(event);
    const record: Record<string, unknown> = {
      audit: true,
      timestamp: new Date().toISOString(),
      event: eventName,
      action: details.action,
      outcome: details.outcome,
      actor,
      sourceIp: resolveSourceIp(event),
      userAgent: readHeader(event, 'user-agent'),
      requestId: resolveRequestId(event),
      target: details.target,
    };

    if (details.detail) {
      record.detail = sanitizeDetail(details.detail) as Record<string, unknown>;
    }

    console.log(JSON.stringify(removeUndefined(record)));
  } catch (error) {
    console.error('[audit] Failed to emit audit event:', error);
  }
}

async function resolveActor(event?: H3Event<EventHandlerRequest>): Promise<string> {
  if (event) {
    const session = await getUserSession(event).catch(() => null);
    const user = session?.user as { login?: string; email?: string } | undefined;
    if (user?.login) return user.login;
    if (user?.email) return user.email;
  }

  if (readHeader(event, 'authorization')) {
    return 'token-mode';
  }

  return 'anonymous';
}

function resolveSourceIp(event?: H3Event<EventHandlerRequest>): string | undefined {
  const forwardedFor = readHeader(event, 'x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  return readHeader(event, 'x-real-ip')
    || readHeader(event, 'cf-connecting-ip')
    || readHeader(event, 'true-client-ip')
    || readHeader(event, 'fastly-client-ip')
    || event?.node?.req?.socket?.remoteAddress;
}

function resolveRequestId(event?: H3Event<EventHandlerRequest>): string | undefined {
  const context = event?.context as Record<string, unknown> | undefined;
  return readHeader(event, 'x-request-id')
    || readHeader(event, 'x-correlation-id')
    || readHeader(event, 'request-id')
    || (typeof context?.requestId === 'string' ? context.requestId : undefined);
}

function readHeader(event: H3Event<EventHandlerRequest> | undefined, name: string): string | undefined {
  if (!event) return undefined;

  try {
    const value = getRequestHeader(event, name);
    if (value) return value;
  } catch {
    // Fall back to test/plain-H3 shapes below.
  }

  const lower = name.toLowerCase();
  const contextHeaders = (event.context as { headers?: Headers | Record<string, unknown> } | undefined)?.headers;
  if (contextHeaders instanceof Headers) {
    return contextHeaders.get(name) ?? undefined;
  }
  if (contextHeaders && typeof contextHeaders === 'object') {
    const direct = contextHeaders[lower] ?? contextHeaders[name];
    if (typeof direct === 'string') return direct;
  }

  const nodeHeaders = event.node?.req?.headers as Record<string, string | string[] | undefined> | undefined;
  const raw = nodeHeaders?.[lower];
  if (Array.isArray(raw)) return raw.join(', ');
  return raw;
}

function sanitizeDetail(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDetail(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_DETAIL_KEY.test(key) ? '[redacted]' : sanitizeDetail(nested),
      ])
    );
  }
  return value;
}

function removeUndefined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}
