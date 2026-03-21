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

/**
 * Fetch all members of a team (org team scope) handling GitHub API pagination.
 * For now this is limited to organization team scopes. Enterprise team member
 * listing requires resolving the parent organization; that enhancement can be
 * added later if needed.
 *
 * @param options Options containing scope/org/team information
 * @param headers Headers (with Authorization) forwarded from the incoming request
 * @returns Array of team member objects returned by the GitHub API
 */
export async function fetchAllTeamMembers(options: Options, headers: HeadersInit): Promise<TeamMember[]> {
  // Only proceed for explicit team scopes with an organization + team slug
  if (!(options.scope === 'team-organization' || options.scope === 'team-enterprise') || !options.githubTeam) {
    return [];
  }

  const membersUrl = options.getTeamMembersApiUrl();
  const perPage = 100;
  let page = 1;
  const members: TeamMember[] = [];

  /*
   * Loop until an empty page (or a short page) is returned. We purposely do
   * not rely on the Link header to keep the implementation simple & robust
   * under mocking. If rate limiting becomes a concern this can be replaced
   * with Link header parsing.
   */
  while (true) {
    const pageData = await $fetch<TeamMember[]>(membersUrl, {
      headers,
      params: { per_page: perPage, page }
    });

    if (!Array.isArray(pageData) || pageData.length === 0) break;
    members.push(...pageData);
    if (pageData.length < perPage) break; // last page
    page += 1;
  }

  return members;
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
    const seatsData = deduplicateSeats(
      dataJson.seats.map((item: unknown) => new Seat(item))
    );
    logger.info('Using mocked data');
    return paginateSeats(seatsData, uiPage, uiPerPage);
  }

  if (!event.context.headers.has('Authorization')) {
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
    return new Response('No Authentication provided', { status: 401 });
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
      return new Response('Error fetching seats data. Error: ' + String(error), { status: status || 500 });
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

    const pageSeats = deduplicateSeats(fetched).slice(localOffset, localOffset + uiPerPage);
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
    return new Response('Error fetching seats data. Error: ' + String(error), { status: status || 500 });
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