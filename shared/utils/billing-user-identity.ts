export type BillingUserAliases = Record<string, string>;

export class BillingUserAliasError extends Error {
  constructor() {
    super('NUXT_BILLING_USER_ALIASES must be a JSON object of unambiguous billing username to metrics login mappings (no chains or cycles).');
    this.name = 'BillingUserAliasError';
  }
}

function canonicalUserKey(value: string): string {
  return value.trim().toLowerCase();
}

export function parseBillingUserAliases(raw: string | undefined): BillingUserAliases {
  const aliases: BillingUserAliases = Object.create(null);
  if (!raw?.trim()) return aliases;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BillingUserAliasError();
    if (Object.values(parsed).some(value => typeof value !== 'string')) throw new BillingUserAliasError();
    // JSON.parse alone discards duplicate keys. Inspect the validated flat
    // string-object tokens so even escaped duplicate keys cannot pick an owner.
    const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}:,]/g)!;
    for (let i = 1; i < tokens.length - 1; i += 4) {
      const billingUsername = JSON.parse(tokens[i]!) as string;
      const metricsLogin = JSON.parse(tokens[i + 2]!) as string;
      const billingKey = canonicalUserKey(billingUsername);
      const metricsKey = canonicalUserKey(metricsLogin);
      if (!billingKey || !metricsKey || (Object.hasOwn(aliases, billingKey) && aliases[billingKey] !== metricsKey)) {
        throw new BillingUserAliasError();
      }
      aliases[billingKey] = metricsKey;
    }
    for (const metricsKey of Object.values(aliases)) {
      if (Object.hasOwn(aliases, metricsKey) && aliases[metricsKey] !== metricsKey) {
        throw new BillingUserAliasError();
      }
    }
    return aliases;
  } catch {
    throw new BillingUserAliasError();
  }
}

export function normalizeBillingUsername(username: string, aliases: BillingUserAliases): string {
  const key = canonicalUserKey(username);
  return Object.hasOwn(aliases, key) ? aliases[key]! : key;
}

export function billingUsernamesForMetricsLogins(
  logins: string[],
  aliases: BillingUserAliases,
): string[] {
  const metricsKeys = new Set(logins.map(canonicalUserKey).filter(Boolean));
  const usernames = new Set([...metricsKeys].filter(key => normalizeBillingUsername(key, aliases) === key));
  for (const [billingUsername, metricsLogin] of Object.entries(aliases)) {
    if (metricsKeys.has(metricsLogin)) usernames.add(billingUsername);
  }
  return [...usernames];
}
