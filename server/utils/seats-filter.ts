import { Seat } from '@/model/Seat'
import type { TeamMember } from '../api/seats'

/**
 * Filter seats to only include those whose assignee is a member of the given team.
 * Matches on numeric id first; falls back to login for seats with id === 0.
 * When teamMembers is empty the original list is returned unchanged.
 */
export function filterSeatsByTeamMembers(seats: Seat[], teamMembers: TeamMember[]): Seat[] {
  if (teamMembers.length === 0) return seats

  const memberIds    = new Set(teamMembers.map(m => m.id).filter(id => id > 0))
  const memberLogins = new Set(teamMembers.map(m => m.login.toLowerCase()))

  return seats.filter(
    seat => memberIds.has(seat.id) || memberLogins.has(seat.login.toLowerCase())
  )
}
