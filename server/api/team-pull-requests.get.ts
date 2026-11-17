/**
 * On-demand team pull request metrics.
 *
 * Deliberately NOT part of /api/metrics: it hits the rate-limited GitHub
 * search API, so it is only ever called when the user explicitly asks for PR
 * data in the Teams tab. Results are cached per (team, date range).
 *
 * Responds 429 when GitHub rate limits the caller and 403 when the credential
 * cannot read the organization's pull requests.
 */

import { Options, type Scope } from '@/model/Options';
import { requireTeamMembershipOrAdmin } from '../utils/team-membership';
import { fetchAllTeamMembers } from './seats';
import { fetchTeamPrMetrics, SearchAccessError, SearchRateLimitError, buildWeekBuckets, rollingAverage, type TeamPrMetrics } from '../services/team-pr-search';
import { getCachedTeamPrMetrics, saveTeamPrMetrics } from '../storage/team-pr-metrics-storage';

/** Default reporting window, matching the rest of the dashboard. */
const DEFAULT_RANGE_DAYS = 28;

function defaultRange(): { since: string; until: string } {
  const until = new Date().toISOString().split('T')[0]!;
  const since = new Date(Date.now() - (DEFAULT_RANGE_DAYS - 1) * 86400000)
    .toISOString().split('T')[0]!;
  return { since, until };
}

/**
 * Extract the bearer token the GitHub middleware attached to the request,
 * falling back to the server's configured PAT.
 */
function resolveToken(event: Parameters<typeof getQuery>[0], configToken: string | undefined): string | undefined {
  const header = (event as { context: { headers?: Headers } }).context?.headers?.get('Authorization');
  const fromHeader = header?.replace(/^(Bearer|token)\s+/i, '').trim();
  return fromHeader || configToken;
}

export default defineEventHandler(async (event): Promise<TeamPrMetrics> => {
  const logger = console;
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  if (!options.scope && config.public.scope) options.scope = config.public.scope as Scope;
  if (!options.githubOrg && config.public.githubOrg && options.scope !== 'enterprise') {
    options.githubOrg = config.public.githubOrg as string;
  }

  if (!options.githubTeam) {
    throw createError({ statusCode: 400, statusMessage: 'team query parameter is required' });
  }

  // Same GDPR gate as /api/metrics — team-scoped data is not open to everyone.
  await requireTeamMembershipOrAdmin(
    event,
    (options.scope || 'organization') as Scope,
    options.githubOrg,
    options.githubTeam,
  );

  const fallback = defaultRange();
  const since = options.since || fallback.since;
  const until = options.until || fallback.until;
  const identifier = options.githubOrg || options.githubEnt || '';
  const cacheKey = { scope: options.scope || 'organization', identifier, teamSlug: options.githubTeam, since, until };

  if (options.isDataMocked) {
    const members = await fetchAllTeamMembers(options, event.context.headers);
    return mockMetrics(since, until, members.length, options.githubTeam);
  }

  try {
    const cached = await getCachedTeamPrMetrics(cacheKey);
    if (cached) return cached;
  } catch (err) {
    logger.error('Team PR cache read failed (non-fatal):', err);
  }

  const githubToken = resolveToken(event, config.githubToken as string | undefined);
  if (!githubToken) {
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  const members = await fetchAllTeamMembers(options, event.context.headers);
  if (members.length === 0) {
    throw createError({ statusCode: 404, statusMessage: `No members found for team ${options.githubTeam}` });
  }

  try {
    const metrics = await fetchTeamPrMetrics({
      logins: members.map(m => m.login),
      since,
      until,
      // Search must be restricted to the org's repositories, otherwise a
      // member's unrelated open-source PRs would be counted.
      org: options.githubOrg,
      githubToken,
      apiBaseUrl: config.githubApiBaseUrl as string | undefined,
    });

    try {
      await saveTeamPrMetrics(cacheKey, metrics);
    } catch (err) {
      logger.error('Team PR cache write failed (non-fatal):', err);
    }

    return metrics;
  } catch (error) {
    if (error instanceof SearchRateLimitError) {
      throw createError({
        statusCode: 429,
        statusMessage: error.message,
        data: { retryAfterMinutes: error.retryAfterMinutes },
      });
    }
    if (error instanceof SearchAccessError) {
      logger.warn(error.message);
      throw createError({ statusCode: 403, statusMessage: error.message });
    }
    logger.error('Team PR search failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching team pull request data: ' + (error instanceof Error ? error.message : String(error)),
    });
  }
});

/**
 * Deterministic mock so the Teams tab is demoable without a token. Values are
 * derived from the team slug so different teams look different but a given
 * team is stable across reloads.
 */
function mockMetrics(since: string, until: string, memberCount: number, teamSlug: string): TeamPrMetrics {
  const seed = [...teamSlug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const weeks = buildWeekBuckets(since, until).map((bucket, i) => {
    const merged = 4 + ((seed + i * 7) % 11);
    return { ...bucket, merged, aiTouched: Math.round(merged * (0.3 + ((seed + i) % 5) / 10)) };
  });
  const totalMerged = weeks.reduce((sum, w) => sum + w.merged, 0);

  return {
    weeks,
    totalMerged,
    totalAiTouched: weeks.reduce((sum, w) => sum + w.aiTouched, 0),
    rollingAverage: rollingAverage(weeks),
    avgMergedPerPerson: memberCount > 0 ? totalMerged / memberCount : null,
    memberCount,
    truncated: false,
    orgScoped: true,
  };
}
