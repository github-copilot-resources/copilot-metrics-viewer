import { Seat } from "@/model/Seat";
import { readFileSync } from 'fs';
import { Options } from '@/model/Options';
import { resolve } from 'path';

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

export default defineEventHandler(async (event) => {

  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  const apiUrl = options.getSeatsApiUrl();
  const mockedDataPath = options.getSeatsMockDataPath();

  if (options.isDataMocked && mockedDataPath) {
    const path = resolve(mockedDataPath);
    const data = readFileSync(path, 'utf8');
    const dataJson = JSON.parse(data);
    const seatsData = dataJson.seats.map((item: unknown) => new Seat(item));

    // Deduplicate seats by user ID to handle enterprise scenarios where users are assigned to multiple organizations
    const deduplicatedSeats = deduplicateSeats(seatsData);

    logger.info('Using mocked data');
    return deduplicatedSeats;
  }

  if (!event.context.headers.has('Authorization')) {
    logger.error('No Authentication provided');
    return new Response('No Authentication provided', { status: 401 });
  }

  const perPage = 100;
  let page = 1;
  let response;
  logger.info(`Fetching 1st page of seats data from ${apiUrl}`);

  try {
    response = await $fetch(apiUrl, {
      headers: event.context.headers,
      params: {
        per_page: perPage,
        page: page
      }
    }) as { seats: unknown[], total_seats: number };
  } catch (error: FetchError) {
    logger.error('Error fetching seats data:', error);
    return new Response('Error fetching seats data. Error: ' + error, { status: error.statusCode || 500 });
  }

  let seatsData = response.seats.map((item: unknown) => new Seat(item));

  // Calculate the total pages
  const totalSeats = response.total_seats;
  const totalPages = Math.ceil(totalSeats / perPage);

  // Fetch the remaining pages
  for (page = 2; page <= totalPages; page++) {
    response = await $fetch(apiUrl, {
      headers: event.context.headers,
      params: {
        per_page: perPage,
        page: page
      }
    }) as { seats: unknown[], total_seats: number };

    seatsData = seatsData.concat(response.seats.map((item: unknown) => new Seat(item)));
  }

  // Deduplicate seats by user ID to handle enterprise scenarios where users are assigned to multiple organizations
  const deduplicatedSeats = deduplicateSeats(seatsData);

  return deduplicatedSeats;
})