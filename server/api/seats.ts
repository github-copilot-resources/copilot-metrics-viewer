import { Seat } from "@/model/Seat";
import { readFileSync } from 'fs';
import { Options } from '@/model/Options';
import { resolve } from 'path';
import { getLatestSeats } from '../storage/seats-storage';

/** UI page size cap — GitHub API max is 100, so 300 = 3 GitHub calls per page. */
const UI_MAX_PER_PAGE = 300;
/** GitHub Billing Seats API page size limit. */
const GITHUB_PER_PAGE = 100;

/**
 * Paginated response shape returned by this endpoint.
 * Replaces the previous bare Seat[] so the client can drive a paginator.
 */
export interface SeatsApiResponse {
  seats: Seat[];
  total_seats: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Minimal shape of a GitHub team member object we care about
export interface TeamMember {
  login: string;
  id: number;
  [key: string]: unknown; // allow additional fields without using any
}

// Mock team membership — matches the mock teams defined in teams.ts
const MOCK_TEAM_MEMBERS: Record<string, TeamMember[]> = {
  'the-a-team':    [{ login: 'monalisa', id: 1 }, { login: 'defunkt', id: 2 }, { login: 'octocat', id: 4 }, { login: 'octokitten', id: 5 }],
  'dev-team':      [{ login: 'defunkt', id: 2 }, { login: 'octocat', id: 4 }, { login: 'octokitten', id: 5 }, { login: 'hubot', id: 8 }, { login: 'alicechen', id: 6 }, { login: 'bobmartinez', id: 7 }],
  'frontend-team': [{ login: 'codertocat', id: 3 }, { login: 'alicechen', id: 6 }, { login: 'bobmartinez', id: 7 }],
  'backend-team':  [{ login: 'defunkt', id: 2 }, { login: 'octocat', id: 4 }, { login: 'octokitten', id: 5 }, { login: 'hubot', id: 8 }],
  'qa-team':       [{ login: 'hubot', id: 8 }, { login: 'alicechen', id: 6 }, { login: 'bobmartinez', id: 7 }],
};

/**
 * Fetch all members of a team handling GitHub API pagination.
 * Supports both organization teams (via /members) and enterprise teams
 * (via /memberships with X-GitHub-Api-Version: 2026-03-10).
 *
 * @param options Options containing scope/org/team information
 * @param headers Headers (with Authorization) forwarded from the incoming request
 * @returns Array of team member objects returned by the GitHub API
 */
export async function fetchAllTeamMembers(options: Options, headers: HeadersInit): Promise<TeamMember[]> {
  if (!options.githubTeam) {
    return [];
  }

  // Mock mode: return pre-defined team membership without hitting GitHub API
  if (options.isDataMocked) {
    return MOCK_TEAM_MEMBERS[options.githubTeam] ?? [];
  }

  const membersUrl = options.getTeamMembersApiUrl();
  const perPage = 100;
  let page = 1;
  const members: TeamMember[] = [];

  // Build headers: add API version for enterprise team memberships
  // (not needed when using org-based teams API, e.g. Full GHEC org teams)
  const fetchHeaders: Record<string, string> = {};
  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      fetchHeaders[key] = value;
    }
  } else if (typeof headers === 'object') {
    Object.assign(fetchHeaders, headers);
  }
  if (options.scope === 'enterprise' && !options.githubOrg) {
    delete fetchHeaders['x-github-api-version'];
    fetchHeaders['X-GitHub-Api-Version'] = '2026-03-10';
  }

  while (true) {
    const pageData = await $fetch<TeamMember[]>(membersUrl, {
      headers: fetchHeaders,
      params: { per_page: perPage, page }
    });

    if (!Array.isArray(pageData) || pageData.length === 0) break;
    // Normalize: enterprise /memberships may nest user data under a `user` property
    for (const item of pageData) {
      const member = normalizeTeamMember(item);
      if (member) members.push(member);
    }
    if (pageData.length < perPage) break; // last page
    page += 1;
  }

  return members;
}

/**
 * Normalize a team member response item into {login, id}.
 * Handles both flat user objects and potentially nested membership objects.
 */
function normalizeTeamMember(item: Record<string, unknown>): TeamMember | null {
  // Flat user object (standard shape from both /members and /memberships)
  if (typeof item.login === 'string' && typeof item.id === 'number') {
    return item as TeamMember;
  }
  // Nested membership object (defensive: { user: { login, id } })
  if (item.user && typeof item.user === 'object') {
    const user = item.user as Record<string, unknown>;
    if (typeof user.login === 'string' && typeof user.id === 'number') {
      return user as TeamMember;
    }
  }
  return null;
}

/**
 * Deduplicates seats by user ID, keeping the seat with the most recent activity.
 * This handles enterprise scenarios where users are assigned to multiple organizations.
 * @param seats Array of seats to deduplicate
 * @returns Array of unique seats
 */
function deduplicateSeats(seats: Seat[]): Seat[] {
  const uniqueSeats = new Map<number, Seat>();

  for (const seat of seats) {
    // Skip seats with invalid user ID
    if (!seat.id || seat.id === 0) {
      continue;
    }

    const existingSeat = uniqueSeats.get(seat.id);
    if (!existingSeat) {
      uniqueSeats.set(seat.id, seat);
    } else {
      // Keep the seat with more recent activity, treating null as earliest date
      const seatActivity = seat.last_activity_at || '1970-01-01T00:00:00Z';
      const existingActivity = existingSeat.last_activity_at || '1970-01-01T00:00:00Z';

      if (seatActivity > existingActivity) {
        uniqueSeats.set(seat.id, seat);
      }
    }
  }

  return Array.from(uniqueSeats.values());
}

/** Build a SeatsApiResponse given a fully-resolved seat list and pagination params. */
function paginateSeats(allSeats: Seat[], page: number, perPage: number): SeatsApiResponse {
  const total_seats = allSeats.length;
  const total_pages = Math.max(1, Math.ceil(total_seats / perPage));
  const safePage = Math.min(Math.max(1, page), total_pages);
  const start = (safePage - 1) * perPage;
  return {
    seats: allSeats.slice(start, start + perPage),
    total_seats,
    page: safePage,
    per_page: perPage,
    total_pages,
  };
}

export default defineEventHandler(async (event) => {

  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Parse UI pagination params ───────────────────────────────────────────
  const uiPage    = Math.max(1, parseInt(String(query.page    ?? '1'),  10) || 1);
  const uiPerPage = Math.min(UI_MAX_PER_PAGE,
                     Math.max(1, parseInt(String(query.per_page ?? '300'), 10) || 300));

  const apiUrl = options.getSeatsApiUrl();
  const mockedDataPath = options.getSeatsMockDataPath();

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (options.isDataMocked && mockedDataPath) {
    const path = resolve(mockedDataPath);
    const data = readFileSync(path, 'utf8');
    const dataJson = JSON.parse(data);
    let seatsData = deduplicateSeats(
      dataJson.seats.map((item: unknown) => new Seat(item))
    );
    // Apply team filter in mock mode
    if (options.githubTeam) {
      const mockMembers = MOCK_TEAM_MEMBERS[options.githubTeam] ?? [];
      const memberLogins = new Set(mockMembers.map(m => m.login.toLowerCase()));
      seatsData = seatsData.filter(s => memberLogins.has(s.login.toLowerCase()));
    }
    logger.info('Using mocked data');
    return paginateSeats(seatsData, uiPage, uiPerPage);
  }

  if (!event.context.headers?.has('Authorization')) {
    // ── Historical mode without auth — serve from DB ───────────────────────
    if (process.env.ENABLE_HISTORICAL_MODE === 'true') {
      logger.info('No auth in historical mode, serving latest seats from storage');
      const scope      = options.scope      || 'organization';
      const identifier = options.githubOrg  || options.githubEnt || '';
      const stored = identifier ? await getLatestSeats(scope, identifier) : null;
      const seats  = stored ? deduplicateSeats(stored) : [];
      return paginateSeats(seats, uiPage, uiPerPage);
    }
    logger.error('No Authentication provided');
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  // ── Historical mode with auth — DB first, live fallback ───────────────────
  if (process.env.ENABLE_HISTORICAL_MODE === 'true') {
    const scope      = options.scope      || 'organization';
    const identifier = options.githubOrg  || options.githubEnt || '';
    if (identifier) {
      const stored = await getLatestSeats(scope, identifier);
      if (stored) {
        logger.info(`Serving ${stored.length} seats from storage`);
        return paginateSeats(deduplicateSeats(stored), uiPage, uiPerPage);
      }
      logger.info('No seats in storage yet, falling back to live API');
    }
  }

  // if scope is team - get team members (needed for filtering — always fetch all)
  const teamMembers: TeamMember[] = await fetchAllTeamMembers(options, event.context.headers);

  // ── Organization scope: fetch only the GitHub pages needed for this UI page ─
  // For enterprise and team scopes we need all pages (for deduplication / filtering),
  // so we fall through to the "fetch all" path below.
  const isOrgOnly = options.scope === 'organization';

  if (isOrgOnly) {
    // Determine which GitHub pages cover the requested UI page window
    const offsetStart    = (uiPage - 1) * uiPerPage;
    const offsetEnd      = offsetStart + uiPerPage;
    const ghPageStart    = Math.floor(offsetStart / GITHUB_PER_PAGE) + 1;
    const ghPageEnd      = Math.ceil(offsetEnd     / GITHUB_PER_PAGE);
    const localOffset    = offsetStart - (ghPageStart - 1) * GITHUB_PER_PAGE;

    let firstResponse: { seats: unknown[]; total_seats: number };
    logger.info(`Fetching GitHub page ${ghPageStart} of seats for org scope (UI page ${uiPage})`);
    try {
      firstResponse = await $fetch(apiUrl, {
        headers: event.context.headers,
        params: { per_page: GITHUB_PER_PAGE, page: ghPageStart }
      }) as { seats: unknown[]; total_seats: number };
    } catch (error: unknown) {
      logger.error('Error fetching seats data:', error);
      const status = typeof error === 'object' && error && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode : 500;
      throw createError({ statusCode: status || 500, statusMessage: 'Error fetching seats data. Error: ' + String(error) });
    }

    const totalSeats = firstResponse.total_seats;
    const totalPages = Math.max(1, Math.ceil(totalSeats / uiPerPage));
    const ghTotalPages = Math.ceil(totalSeats / GITHUB_PER_PAGE);
    const safeGhPageEnd = Math.min(ghPageEnd, ghTotalPages);

    let fetched: Seat[] = firstResponse.seats.map((item: unknown) => new Seat(item));

    for (let p = ghPageStart + 1; p <= safeGhPageEnd; p++) {
      const resp = await $fetch(apiUrl, {
        headers: event.context.headers,
        params: { per_page: GITHUB_PER_PAGE, page: p }
      }) as { seats: unknown[]; total_seats: number };
      fetched = fetched.concat(resp.seats.map((item: unknown) => new Seat(item)));
    }

    // Deduplicate first (handles rare cases where a user appears in multiple pages),
    // then slice to the window within these fetched pages.
    const deduped    = deduplicateSeats(fetched);
    const pageSeats  = deduped.slice(localOffset, localOffset + uiPerPage);
    return {
      seats: pageSeats,
      total_seats: totalSeats,
      page: uiPage,
      per_page: uiPerPage,
      total_pages: totalPages,
    } satisfies SeatsApiResponse;
  }

  // ── Enterprise / team scopes: fetch all pages, then paginate in memory ────
  let firstResponse: { seats: unknown[]; total_seats: number };
  logger.info(`Fetching 1st page of seats data from ${apiUrl}`);
  try {
    firstResponse = await $fetch(apiUrl, {
      headers: event.context.headers,
      params: { per_page: GITHUB_PER_PAGE, page: 1 }
    }) as { seats: unknown[]; total_seats: number };
  } catch (error: unknown) {
    logger.error('Error fetching seats data:', error);
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode : 500;
    throw createError({ statusCode: status || 500, statusMessage: 'Error fetching seats data. Error: ' + String(error) });
  }

  let seatsData = firstResponse.seats.map((item: unknown) => new Seat(item));
  const totalGhPages = Math.ceil(firstResponse.total_seats / GITHUB_PER_PAGE);

  for (let p = 2; p <= totalGhPages; p++) {
    const resp = await $fetch(apiUrl, {
      headers: event.context.headers,
      params: { per_page: GITHUB_PER_PAGE, page: p }
    }) as { seats: unknown[]; total_seats: number };
    seatsData = seatsData.concat(resp.seats.map((item: unknown) => new Seat(item)));
  }

  let deduplicatedSeats = deduplicateSeats(seatsData);

  if (teamMembers.length > 0) {
    deduplicatedSeats = deduplicatedSeats.filter(
      seat => teamMembers.some(member => member.id === seat.id)
    );
  }

  return paginateSeats(deduplicatedSeats, uiPage, uiPerPage);
})