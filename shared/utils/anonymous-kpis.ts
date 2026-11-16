/** Fixed-size anonymous scalars; never include identities, dates or breakdowns. */
export interface SeatsSummary {
  assigned: number;
  never_used: number | null;
  inactive_7: number | null;
  inactive_30: number | null;
}

export interface UserSummary {
  total_users: number;
  active_users: number;
  generated: number;
  accepted: number;
}

export const USER_SUMMARY_HEADER = 'x-copilot-user-summary';

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hasKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

export function parseSeatsSummary(value: unknown): SeatsSummary | null {
  if (value == null) return null;
  if (!hasKeys(value, ['assigned', 'never_used', 'inactive_7', 'inactive_30'])
    || !isCount(value.assigned)) {
    throw new Error('Invalid anonymous seat summary');
  }
  const assigned = value.assigned;
  if (!['never_used', 'inactive_7', 'inactive_30'].every(key =>
    value[key] === null || (isCount(value[key]) && value[key] <= assigned))) {
    throw new Error('Invalid anonymous seat summary');
  }
  return {
    assigned: value.assigned,
    never_used: value.never_used as number | null,
    inactive_7: value.inactive_7 as number | null,
    inactive_30: value.inactive_30 as number | null,
  };
}

export function parseUserSummaryHeader(header: string | null): UserSummary | null {
  if (header === null) return null;
  let value: unknown;
  try { value = JSON.parse(header); } catch { throw new Error('Invalid anonymous user summary'); }
  if (!hasKeys(value, ['total_users', 'active_users', 'generated', 'accepted'])
    || !isCount(value.total_users) || !isCount(value.active_users)
    || !isCount(value.generated) || !isCount(value.accepted)
    || value.active_users > value.total_users) {
    throw new Error('Invalid anonymous user summary');
  }
  return {
    total_users: value.total_users, active_users: value.active_users,
    generated: value.generated, accepted: value.accepted,
  };
}
