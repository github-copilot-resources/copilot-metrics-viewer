import type { Seat } from '@/model/Seat';
import type { UserTotals } from '../services/github-copilot-usage-api';
import type { SeatsSummary, UserSummary } from '#shared/utils/anonymous-kpis';

/** Call only with a complete, deduplicated and authorized scope/team list. */
export function summarizeSeats(seats: Seat[], now = new Date()): SeatsSummary {
  const week = new Date(now);
  const month = new Date(now);
  week.setDate(week.getDate() - 7);
  month.setDate(month.getDate() - 30);
  let neverUsed = 0;
  let inactive7 = 0;
  let inactive30 = 0;
  for (const seat of seats) {
    if (!seat.last_activity_at) {
      neverUsed++;
    } else {
      const activity = new Date(seat.last_activity_at);
      if (activity < week) inactive7++;
      if (activity < month) inactive30++;
    }
  }
  return { assigned: seats.length, never_used: neverUsed, inactive_7: inactive7, inactive_30: inactive30 };
}

/** The existing KPI uses a ratio of sums, not a mean of user percentages. */
export function summarizeUsers(users: UserTotals[]): UserSummary {
  const summary: UserSummary = { total_users: users.length, active_users: 0, generated: 0, accepted: 0 };
  for (const user of users) {
    if (user.total_active_days >= 7) summary.active_users++;
    summary.generated += user.code_generation_activity_count;
    summary.accepted += user.code_acceptance_activity_count;
  }
  return summary;
}
