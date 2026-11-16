/**
 * Team-level pull request metrics derived from the GitHub search API.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Copilot Usage Metrics API exposes `pull_requests` only on
 * organization/enterprise reports — there is no team-scoped report endpoint
 * (`MetricsReportRequest.teamSlug` is never used by the URL builders). Merging
 * org-wide PR totals into a team view would silently mislabel org numbers as
 * team numbers, so team PR metrics are derived here instead, from PRs actually
 * authored by (or assigned to) the team's members.
 *
 * COST CONTROL
 * ------------
 * Every week bucket needs three counts, and member logins must be chunked to
 * respect GitHub's 256-character search query limit. Searches are sent as
 * aliased fields in small GraphQL documents to avoid GitHub query timeouts.
 * This endpoint is only ever invoked on explicit user action.
 *
 * Search skips repositories the credential cannot read. An org-wide probe
 * makes a credential with no visible pull requests an actionable error.
 */

/** GitHub search caps query strings at 256 characters. */
const MAX_SEARCH_QUERY_LENGTH = 256;

/** Keep each GraphQL document below GitHub's practical search timeout. */
export const MAX_SEARCHES_PER_REQUEST = 24;

/** Org-wide search used to detect when no pull requests are visible. */
export const ORG_PR_PROBE_ALIAS = 'orgPullRequests';

/**
 * Upper bound on author chunks per request, so a very large team cannot
 * generate an unbounded GraphQL document. Results are flagged `truncated`
 * when members are dropped.
 */
const MAX_AUTHOR_CHUNKS = 12;

/** GitHub search exposes at most 1,000 results per query. */
const MAX_AGENT_PAGES = 10;

/** Login of the Copilot coding agent as it appears as a PR author. */
export const COPILOT_AGENT_AUTHOR = 'Copilot';

/** Login of the Copilot code review bot as it appears in `reviewed-by:`. */
export const COPILOT_REVIEWER = 'copilot-pull-request-reviewer[bot]';

export interface WeekBucket {
  /** Inclusive first day of the bucket (clipped to the requested range). */
  weekStart: string;
  /** Inclusive last day of the bucket (clipped to the requested range). */
  weekEnd: string;
  /**
   * True when the requested range clipped this ISO week. Partial buckets are
   * still displayed but excluded from the rolling average, so a half-week
   * cannot drag the trend down.
   */
  partial: boolean;
}

export interface WeekPrCounts extends WeekBucket {
  /** PRs authored by team members, plus agent PRs assigned to them. */
  merged: number;
  /** Of `merged`, those Copilot reviewed or the Copilot agent authored. */
  aiTouched: number;
}

export interface TeamPrMetrics {
  weeks: WeekPrCounts[];
  totalMerged: number;
  totalAiTouched: number;
  /** Mean merged PRs per *complete* week. */
  rollingAverage: number;
  /** `totalMerged` divided by team size; null when the team size is unknown. */
  avgMergedPerPerson: number | null;
  memberCount: number;
  /** True when members or agent search results were capped; counts are lower bounds. */
  truncated: boolean;
  /**
   * False when no org could be determined, meaning results are not restricted
   * to the organization's repositories.
   */
  orgScoped: boolean;
}

/** Thrown when GitHub reports the caller is rate limited. */
export class SearchRateLimitError extends Error {
  readonly retryAfterMinutes: number;
  constructor(retryAfterMinutes: number) {
    super(`GitHub search rate limit exceeded. Retry in ${retryAfterMinutes} minute(s).`);
    this.name = 'SearchRateLimitError';
    this.retryAfterMinutes = retryAfterMinutes;
  }
}

/** Thrown when the credential cannot see pull requests in the organization. */
export class SearchAccessError extends Error {
  constructor(org: string) {
    super(
      `No pull requests in ${org} are visible to the GitHub credential this dashboard uses, so merged PRs cannot be counted. `
      + "Give that credential read access to the organization's repositories "
      + '(classic PAT or OAuth scope: repo; fine-grained PAT or GitHub App: Pull requests read-only).'
    );
    this.name = 'SearchAccessError';
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toDayString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function addDays(day: string, n: number): string {
  const d = toUtcDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDayString(d);
}

/** Monday of the ISO week containing `day`. */
function isoWeekStart(day: string): string {
  const d = toUtcDate(day);
  // getUTCDay(): 0 = Sunday. Shift so Monday = 0.
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

/**
 * Split [since, until] into ISO (Monday-start) week buckets clipped to the
 * range. Buckets whose underlying ISO week extends beyond the range are
 * flagged `partial`. Weeks with no activity are still emitted, so the caller
 * renders explicit zeros rather than gaps.
 */
export function buildWeekBuckets(since: string, until: string): WeekBucket[] {
  if (!since || !until || since > until) return [];

  const buckets: WeekBucket[] = [];
  let cursor = isoWeekStart(since);

  while (cursor <= until) {
    const isoEnd = addDays(cursor, 6);
    const weekStart = cursor < since ? since : cursor;
    const weekEnd = isoEnd > until ? until : isoEnd;
    buckets.push({
      weekStart,
      weekEnd,
      partial: weekStart !== cursor || weekEnd !== isoEnd,
    });
    cursor = addDays(cursor, 7);
  }

  return buckets;
}

/**
 * Group logins so that each chunk, once rendered into a search query, stays
 * under GitHub's 256-character limit. Chunks are disjoint, so per-chunk counts
 * can be summed without double counting authors.
 */
export function chunkLogins(logins: string[], baseQueryLength: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = baseQueryLength;

  for (const login of logins) {
    // "author:" prefix plus a separating space.
    const cost = login.length + 8;
    if (current.length > 0 && length + cost > MAX_SEARCH_QUERY_LENGTH) {
      chunks.push(current);
      current = [];
      length = baseQueryLength;
    }
    current.push(login);
    length += cost;
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}

/**
 * Mean merged PRs per complete week. Partial weeks are excluded so a clipped
 * first or last week cannot understate the trend. When every bucket is partial
 * (e.g. a 3-day range) all buckets are used rather than returning nothing.
 */
export function rollingAverage(weeks: WeekPrCounts[]): number {
  if (weeks.length === 0) return 0;
  const complete = weeks.filter(w => !w.partial);
  const considered = complete.length > 0 ? complete : weeks;
  const total = considered.reduce((sum, w) => sum + w.merged, 0);
  return total / considered.length;
}

/**
 * Legacy issue search ORs repeated author/assignee qualifiers.
 * Advanced search would AND them.
 */
function qualifierList(qualifier: string, values: string[]): string {
  return values.map(v => `${qualifier}:${v}`).join(' ');
}

/**
 * Build the three search queries for one week bucket and one author chunk.
 *
 * - `merged`   PRs authored by these members
 * - `reviewed` of those, the ones Copilot code review reviewed
 * - `agent`    PRs the Copilot coding agent authored and assigned to a member
 *
 * `merged` and `agent` are disjoint (a PR's author is either a member or the
 * agent, never both), so totals add without inclusion-exclusion.
 */
export function buildBucketQueries(
  bucket: WeekBucket,
  logins: string[],
  org: string | undefined
): { merged: string; reviewed: string; agent: string } {
  const base = [
    'is:pr',
    'is:merged',
    `merged:${bucket.weekStart}..${bucket.weekEnd}`,
    ...(org ? [`org:${org}`] : []),
  ].join(' ');

  const authors = qualifierList('author', logins);
  const assignees = qualifierList('assignee', logins);

  return {
    merged: `${base} ${authors}`,
    reviewed: `${base} ${authors} reviewed-by:${COPILOT_REVIEWER}`,
    agent: `${base} ${assignees} author:${COPILOT_AGENT_AUTHOR}`,
  };
}

/** Length of the fixed part of a search query, used to size author chunks. */
export function baseQueryLength(bucket: WeekBucket, org: string | undefined): number {
  // The `reviewed` variant is the longest, so size chunks against it.
  return buildBucketQueries(bucket, [], org).reviewed.length;
}

function searchField(alias: string, query: string, after?: string): string {
  if (alias.endsWith('agent')) {
    return `${alias}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: 100${after ? `, after: ${JSON.stringify(after)}` : ''}) { issueCount nodes { ... on PullRequest { id } } pageInfo { hasNextPage endCursor } }`;
  }
  return `${alias}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: 1) { issueCount }`;
}

/**
 * Assemble GraphQL documents covering every (week x chunk) combination.
 * Aliases encode the bucket index, chunk index and which count they carry.
 */
export function buildGraphQLQueries(buckets: WeekBucket[], chunks: string[][], org: string | undefined): string[] {
  const searches: string[] = org ? [searchField(ORG_PR_PROBE_ALIAS, `is:pr org:${org}`)] : [];
  buckets.forEach((bucket, b) => {
    chunks.forEach((chunk, c) => {
      const queries = buildBucketQueries(bucket, chunk, org);
      for (const [kind, query] of Object.entries(queries)) {
        searches.push(searchField(aliasFor(b, c, kind as QueryKind), query));
      }
    });
  });

  const batchCount = Math.ceil(searches.length / MAX_SEARCHES_PER_REQUEST);
  const batchSize = Math.ceil(searches.length / batchCount);
  const documents: string[] = [];
  for (let i = 0; i < searches.length; i += batchSize) {
    documents.push(`query {\n  ${['rateLimit { remaining resetAt }', ...searches.slice(i, i + batchSize)].join('\n  ')}\n}`);
  }
  return documents;
}

type QueryKind = 'merged' | 'reviewed' | 'agent';

export function aliasFor(bucketIndex: number, chunkIndex: number, kind: QueryKind): string {
  return `b${bucketIndex}c${chunkIndex}${kind}`;
}

interface GraphQLSearchResponse {
  data?: Record<string, { issueCount?: number } | unknown>;
  errors?: { type?: string; message: string }[];
}

/**
 * Fold the aliased GraphQL response back into per-week counts.
 *
 * Authors belong to disjoint chunks, but assignees do not: deduplicate agent
 * PR node IDs across every chunk (and page) within each week.
 */
export function collectCounts(
  data: Record<string, unknown>,
  buckets: WeekBucket[],
  chunkCount: number
): WeekPrCounts[] {
  const countAt = (b: number, c: number, kind: QueryKind): number => {
    const node = data[aliasFor(b, c, kind)] as { issueCount?: number } | undefined;
    return node?.issueCount ?? 0;
  };

  return buckets.map((bucket, b) => {
    let merged = 0;
    let aiTouched = 0;
    const agents = new Set<string>();
    for (let c = 0; c < chunkCount; c++) {
      const node = data[aliasFor(b, c, 'agent')] as AgentSearchResult | undefined;
      for (const pr of node?.nodes ?? []) agents.add(pr.id);
      merged += countAt(b, c, 'merged');
      aiTouched += countAt(b, c, 'reviewed');
    }
    return { ...bucket, merged: merged + agents.size, aiTouched: aiTouched + agents.size };
  });
}

interface AgentSearchResult {
  issueCount: number;
  nodes?: { id: string }[];
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
}

/**
 * Minutes until the rate limit resets, from either a `Retry-After` header
 * (seconds), an `x-ratelimit-reset` header (epoch seconds), or a GraphQL
 * `rateLimit.resetAt` timestamp. Always at least 1, so the UI never tells the
 * user to come back in zero minutes.
 */
export function retryAfterMinutes(
  headers: Headers,
  resetAt?: string,
  now: number = Date.now()
): number {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(1, Math.ceil(seconds / 60));
  }

  const reset = headers.get('x-ratelimit-reset');
  if (reset) {
    const epochSeconds = Number(reset);
    if (Number.isFinite(epochSeconds)) {
      return Math.max(1, Math.ceil((epochSeconds * 1000 - now) / 60000));
    }
  }

  if (resetAt) {
    const resetMs = Date.parse(resetAt);
    if (Number.isFinite(resetMs)) {
      return Math.max(1, Math.ceil((resetMs - now) / 60000));
    }
  }

  return 1;
}

function isRateLimited(status: number, json: GraphQLSearchResponse): boolean {
  if (status === 429) return true;
  // GitHub returns 403 for secondary rate limits.
  if (status === 403) return true;
  return (json.errors ?? []).some(e => e.type === 'RATE_LIMITED');
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export interface TeamPrSearchRequest {
  logins: string[];
  since: string;
  until: string;
  org?: string;
  githubToken: string;
  apiBaseUrl?: string;
}

/**
 * Fetch weekly merged/AI-touched PR counts for a team in sequential GraphQL
 * requests.
 *
 * @throws {SearchRateLimitError} when GitHub reports the caller is rate limited
 * @throws {SearchAccessError} when no pull requests are visible in the org
 */
export async function fetchTeamPrMetrics(request: TeamPrSearchRequest): Promise<TeamPrMetrics> {
  const { logins, since, until, org, githubToken, apiBaseUrl = 'https://api.github.com' } = request;

  const buckets = buildWeekBuckets(since, until);
  const memberCount = logins.length;

  if (buckets.length === 0 || memberCount === 0) {
    return emptyMetrics(buckets, memberCount, !!org);
  }

  const allChunks = chunkLogins(logins, baseQueryLength(buckets[0]!, org));
  let truncated = allChunks.length > MAX_AUTHOR_CHUNKS;
  const chunks = truncated ? allChunks.slice(0, MAX_AUTHOR_CHUNKS) : allChunks;

  const data: Record<string, unknown> = {};
  for (const query of buildGraphQLQueries(buckets, chunks, org)) {
    Object.assign(data, await runSearch(query, githubToken, apiBaseUrl));
    const probe = data[ORG_PR_PROBE_ALIAS] as { issueCount?: number } | undefined;
    if (org && probe?.issueCount === 0) throw new SearchAccessError(org);
  }

  for (const [b, bucket] of buckets.entries()) {
    for (const [c, chunk] of chunks.entries()) {
      const alias = aliasFor(b, c, 'agent');
      let page = data[alias] as AgentSearchResult | undefined;
      const nodes = new Map<string, { id: string }>();
      const cursors = new Set<string>();
      const expected = page?.issueCount ?? 0;
      for (let pageNumber = 1; page; pageNumber++) {
        if (page.issueCount > 0 && (!Array.isArray(page.nodes) || !page.pageInfo)) {
          throw new Error('GitHub agent PR search returned incomplete result data');
        }
        for (const node of page.nodes ?? []) {
          if (!node?.id) throw new Error('GitHub agent PR search returned a missing PR identity');
          nodes.set(node.id, node);
        }
        if (!page.pageInfo?.hasNextPage) break;
        if (pageNumber >= MAX_AGENT_PAGES) {
          truncated = true;
          break;
        }
        const cursor = page.pageInfo.endCursor;
        if (!cursor || cursors.has(cursor)) {
          throw new Error('GitHub agent PR search returned an invalid pagination cursor');
        }
        cursors.add(cursor);
        const query = buildBucketQueries(bucket, chunk, org).agent;
        const next = await runSearch(`query { ${searchField(alias, query, cursor)} }`, githubToken, apiBaseUrl);
        page = next[alias] as AgentSearchResult | undefined;
        if (!page) throw new Error('GitHub agent PR search returned a missing page');
      }
      if (nodes.size < expected) truncated = true;
      data[alias] = { issueCount: expected, nodes: [...nodes.values()] };
    }
  }

  const weeks = collectCounts(data, buckets, chunks.length);
  const totalMerged = weeks.reduce((sum, w) => sum + w.merged, 0);

  return {
    weeks,
    totalMerged,
    totalAiTouched: weeks.reduce((sum, w) => sum + w.aiTouched, 0),
    rollingAverage: rollingAverage(weeks),
    avgMergedPerPerson: memberCount > 0 ? totalMerged / memberCount : null,
    memberCount,
    truncated,
    orgScoped: !!org,
  };
}

async function runSearch(query: string, githubToken: string, apiBaseUrl: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${apiBaseUrl}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const json = await response.json().catch(() => ({})) as GraphQLSearchResponse;

  if (isRateLimited(response.status, json)) {
    const resetAt = (json.data?.rateLimit as { resetAt?: string } | undefined)?.resetAt;
    throw new SearchRateLimitError(retryAfterMinutes(response.headers, resetAt));
  }

  if (!response.ok || !json.data || (json.errors?.length ?? 0) > 0) {
    const detail = json.errors?.map(e => e.message).join('; ') || `HTTP ${response.status}`;
    throw new Error(`GitHub PR search failed: ${detail}`);
  }
  return json.data;
}

function emptyMetrics(buckets: WeekBucket[], memberCount: number, orgScoped: boolean): TeamPrMetrics {
  return {
    weeks: buckets.map(b => ({ ...b, merged: 0, aiTouched: 0 })),
    totalMerged: 0,
    totalAiTouched: 0,
    rollingAverage: 0,
    avgMergedPerPerson: memberCount > 0 ? 0 : null,
    memberCount,
    truncated: false,
    orgScoped,
  };
}
