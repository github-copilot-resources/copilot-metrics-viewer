/**
 * Pure seat-processing helpers extracted from server/api/seats.ts.
 *
 * These functions are free of Nuxt auto-imports and can be unit-tested
 * directly without any Nuxt environment setup.
 */

import { Seat } from '@/model/Seat';
import type { SeatsApiResponse, TeamMember } from '../api/seats';

/**
 * Normalize a team member response item into {login, id}.
 * Handles both flat user objects and potentially nested membership objects.
 */
export function normalizeTeamMember(item: Record<string, unknown>): TeamMember | null {
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
export function deduplicateSeats(seats: Seat[]): Seat[] {
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
export function paginateSeats(allSeats: Seat[], page: number, perPage: number): SeatsApiResponse {
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
