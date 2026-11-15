import { $fetch as ofetch } from 'ofetch';
import { Options } from '../../app/model/Options';
import type { DownloadLinksResponse, MetricsReportRequest, UserDayRecord } from './github-copilot-usage-api';
import { requestUserDownloadLinks } from './github-copilot-usage-api';
import { isMockMode } from './github-copilot-usage-api-mock';
import { saveUserDayMetricsBatch } from '../storage/user-day-metrics-storage';
import {
  beginMembershipSnapshot, stageMembershipBatch, publishMembershipSnapshot, failMembershipSnapshot,
  beginUsageSnapshot, stageUsageBatch, completeUsagePart, publishUsageSnapshot, failUsageSnapshot,
  getMembershipSnapshot, getUsageCoverage, validateUsageWindow,
  type MembershipKey, type MembershipResult,
} from '../storage/roster-foundation-storage';

const apiFetch: typeof ofetch = typeof $fetch !== 'undefined' ? $fetch as typeof ofetch : ofetch;

/** Worker-only source. No options/client login list is accepted as membership authority. */
export async function syncTeamMembership(
  key: MembershipKey, headers: HeadersInit, clock: () => Date = () => new Date(),
): Promise<MembershipResult> {
  if (key.teamKind !== 'github' || key.teamKey.startsWith('reports-to:')) return { available: false, reason: 'membership-unavailable' };
  if (isMockMode()) throw new Error('Mock membership cannot publish authoritative coverage');
  const options = new Options({
    scope: key.scope, githubOrg: key.scope === 'organization' ? key.identifier : key.githubOrg,
    githubEnt: key.scope === 'enterprise' ? key.identifier : undefined, githubTeam: key.teamKey,
  });
  const url = options.getTeamMembersApiUrl();
  const fetchHeaders = new Headers(headers);
  if (key.scope === 'enterprise' && !key.githubOrg) fetchHeaders.set('X-GitHub-Api-Version', '2026-03-10');
  const version = await beginMembershipSnapshot(key);
  try {
    for (let page = 1; ; page++) {
      const batch = await apiFetch<unknown>(url, { headers: fetchHeaders, params: { per_page: 100, page } });
      if (!Array.isArray(batch) || batch.length > 100) throw new Error('Invalid membership page');
      const members = batch.map(item => {
        if (!item || typeof item !== 'object') throw new Error('Invalid membership record');
        const member = 'user' in item ? item.user : item;
        if (!member || typeof member.login !== 'string' || !member.login.trim()
          || !Number.isSafeInteger(member.id) || member.id <= 0) throw new Error('Invalid membership record');
        return { login: member.login, userId: member.id };
      });
      await stageMembershipBatch(version, members);
      if (batch.length < 100) break;
    }
    // Freshness begins at upstream traversal completion, not the later DB commit.
    const fetchedAt = clock();
    await publishMembershipSnapshot(version, fetchedAt, clock());
  } catch (error) {
    await failMembershipSnapshot(version).catch(() => undefined);
    throw error;
  }
  return getMembershipSnapshot(key, clock());
}

export function usageReportWindow(
  links: DownloadLinksResponse, requestedDay?: string,
): { since: string; until: string } {
  if (!Array.isArray(links.download_links) || !links.download_links.length
    || links.download_links.some(link => typeof link !== 'string' || !link)
    || new Set(links.download_links).size !== links.download_links.length) throw new Error('Missing or invalid user report parts');
  const since = links.report_day ?? links.report_start_day;
  const until = links.report_day ?? links.report_end_day;
  if (!since || !until) throw new Error('User report has no authoritative coverage window');
  validateUsageWindow(since, until);
  if (requestedDay && (since !== requestedDay || until !== requestedDay)) throw new Error('User report window does not match requested day');
  return { since, until };
}

export function parseUsagePart(raw: string, since: string, until: string): UserDayRecord[] {
  validateUsageWindow(since, until);
  const text = raw.trim();
  if (!text) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch {
    try { parsed = text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line)); }
    catch { throw new Error('Malformed user report record'); }
  }
  const records = Array.isArray(parsed) ? parsed : [parsed];
  for (const record of records) {
    if (!record || typeof record !== 'object' || typeof record.user_login !== 'string'
      || !record.user_login.trim() || typeof record.day !== 'string') throw new Error('User report is not raw per-day usage');
    validateUsageWindow(record.day, record.day);
    if (record.day < since || record.day > until) throw new Error('User row is outside report coverage');
    if (record.user_id !== undefined && (!Number.isSafeInteger(record.user_id) || record.user_id <= 0)) throw new Error('Invalid user identifier');
    if (record.totals_by_cli !== undefined) {
      if (!record.totals_by_cli || typeof record.totals_by_cli !== 'object' || Array.isArray(record.totals_by_cli)) throw new Error('Invalid CLI usage');
      const tokens = record.totals_by_cli.token_usage;
      if (tokens !== undefined && (!tokens || typeof tokens !== 'object'
        || ![tokens.prompt_tokens_sum, tokens.output_tokens_sum].every(value => Number.isSafeInteger(value) && value >= 0))) throw new Error('Invalid CLI tokens');
    }
  }
  return records as UserDayRecord[];
}

/** Real reports are NDJSON. Bound each line and storage batch rather than retaining report parts. */
async function* downloadUsageBatches(url: string, since: string, until: string): AsyncGenerator<UserDayRecord[]> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error('User report download failed');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const maxLine = 1024 * 1024;
  let pending = '';
  let batch: UserDayRecord[] = [];
  function* consume(line: string): Generator<UserDayRecord[]> {
    if (Buffer.byteLength(line, 'utf8') > maxLine) throw new Error('User report line exceeds 1 MiB');
    for (const row of parseUsagePart(line, since, until)) {
      batch.push(row);
      if (batch.length === 1000) { yield batch; batch = []; }
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        yield* consume(pending.slice(0, end));
        pending = pending.slice(end + 1);
      }
      if (Buffer.byteLength(pending, 'utf8') > maxLine) throw new Error('User report line exceeds 1 MiB');
      if (done) break;
    }
    yield* consume(pending);
    if (batch.length) yield batch;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** No pointer moves until every upstream part AND both storage writes succeed. */
export async function syncUserUsage(
  request: MetricsReportRequest, headers: HeadersInit, day?: string, clock: () => Date = () => new Date(),
): Promise<void> {
  if (isMockMode() || request.isMocked) throw new Error('Mock usage cannot publish authoritative coverage');
  if (day && (await getUsageCoverage(request.scope, request.identifier, day, day)).available) return;
  const links = await requestUserDownloadLinks(request, headers, day ? '1-day' : '28-day', day);
  const { since, until } = usageReportWindow(links, day);
  const version = await beginUsageSnapshot(request.scope, request.identifier, since, until, links.download_links.length);
  try {
    for (const [part, url] of links.download_links.entries()) {
      for await (const batch of downloadUsageBatches(url, since, until)) {
        await saveUserDayMetricsBatch(request.scope, request.identifier, batch);
        await stageUsageBatch(version, batch);
      }
      await completeUsagePart(version, part);
    }
    const fetchedAt = clock();
    await publishUsageSnapshot(version, fetchedAt, clock());
  } catch (error) {
    await failUsageSnapshot(version).catch(() => undefined);
    throw error;
  }
}
