export type BillingUserAliases = Record<string, string>;

function canonicalUserKey(value: string): string {
  return value.trim().toLowerCase();
}

export function parseBillingUserAliases(raw: string | undefined): BillingUserAliases {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const aliases: BillingUserAliases = {};
    for (const [billingUsername, metricsLogin] of Object.entries(parsed)) {
      if (typeof metricsLogin !== 'string') continue;
      const billingKey = canonicalUserKey(billingUsername);
      const metricsKey = canonicalUserKey(metricsLogin);
      if (billingKey && metricsKey) aliases[billingKey] = metricsKey;
    }
    return aliases;
  } catch {
    return {};
  }
}

export function normalizeBillingUsername(username: string, aliases: BillingUserAliases): string {
  const key = canonicalUserKey(username);
  return aliases[key] || key;
}

export function billingUsernamesForMetricsLogins(
  logins: string[],
  aliases: BillingUserAliases,
): string[] {
  const metricsKeys = new Set(logins.map(canonicalUserKey).filter(Boolean));
  const usernames = new Set(metricsKeys);
  for (const [billingUsername, metricsLogin] of Object.entries(aliases)) {
    if (metricsKeys.has(metricsLogin)) usernames.add(billingUsername);
  }
  return [...usernames];
}
