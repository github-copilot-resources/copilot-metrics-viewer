// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { Seat } from '@/model/Seat'

// Mock the seats API response with duplicates
const mockSeatsWithDuplicates = [
  {
    assignee: { login: 'user1', id: 1 },
    assigning_team: { name: 'Team A' },
    created_at: '2021-08-03T18:00:00-06:00',
    last_activity_at: '2021-10-14T00:53:32-06:00',
    last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
  },
  {
    assignee: { login: 'user1', id: 1 },
    assigning_team: { name: 'Team B' },
    created_at: '2021-08-04T18:00:00-06:00',
    last_activity_at: '2021-10-15T00:53:32-06:00',
    last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
  },
  {
    assignee: { login: 'user2', id: 2 },
    assigning_team: { name: 'Team A' },
    created_at: '2021-08-03T18:00:00-06:00',
    last_activity_at: '2021-10-12T00:53:32-06:00',
    last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
  }
]

describe('Seat Deduplication', () => {
  test('deduplicates seats by user ID keeping most recent activity', () => {
    const seats = mockSeatsWithDuplicates.map(data => new Seat(data))
    
    // Create a simple deduplication function that we'll implement in the API
    const deduplicate = (seats: Seat[]): Seat[] => {
      const uniqueSeats = new Map<number, Seat>()
      
      for (const seat of seats) {
        const existingSeat = uniqueSeats.get(seat.id)
        if (!existingSeat) {
          uniqueSeats.set(seat.id, seat)
        } else {
          // Keep the one with more recent activity
          if (seat.last_activity_at > existingSeat.last_activity_at) {
            uniqueSeats.set(seat.id, seat)
          }
        }
      }
      
      return Array.from(uniqueSeats.values())
    }
    
    const deduplicatedSeats = deduplicate(seats)
    
    // Should have 2 unique users
    expect(deduplicatedSeats).toHaveLength(2)
    
    // Should have user1 with most recent activity (from Team B)
    const user1 = deduplicatedSeats.find(s => s.id === 1)
    expect(user1).toBeDefined()
    expect(user1!.login).toBe('user1')
    expect(user1!.team).toBe('Team B') // Should be the one with more recent activity
    expect(user1!.last_activity_at).toBe('2021-10-15T00:53:32-06:00')
    
    // Should have user2
    const user2 = deduplicatedSeats.find(s => s.id === 2)
    expect(user2).toBeDefined()
    expect(user2!.login).toBe('user2')
    expect(user2!.team).toBe('Team A')
  })
  
  test('handles seats with same user ID but different activity dates', () => {
    const duplicateSeats = [
      {
        assignee: { login: 'user1', id: 1 },
        assigning_team: { name: 'Old Team' },
        created_at: '2021-08-01T18:00:00-06:00',
        last_activity_at: '2021-10-10T00:53:32-06:00',
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
      },
      {
        assignee: { login: 'user1', id: 1 },
        assigning_team: { name: 'New Team' },
        created_at: '2021-08-05T18:00:00-06:00',
        last_activity_at: '2021-10-20T00:53:32-06:00',
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
      }
    ]
    
    const seats = duplicateSeats.map(data => new Seat(data))
    
    const deduplicate = (seats: Seat[]): Seat[] => {
      const uniqueSeats = new Map<number, Seat>()
      
      for (const seat of seats) {
        const existingSeat = uniqueSeats.get(seat.id)
        if (!existingSeat) {
          uniqueSeats.set(seat.id, seat)
        } else {
          // Keep the one with more recent activity
          if (seat.last_activity_at > existingSeat.last_activity_at) {
            uniqueSeats.set(seat.id, seat)
          }
        }
      }
      
      return Array.from(uniqueSeats.values())
    }
    
    const deduplicatedSeats = deduplicate(seats)
    
    expect(deduplicatedSeats).toHaveLength(1)
    expect(deduplicatedSeats[0].team).toBe('New Team')
    expect(deduplicatedSeats[0].last_activity_at).toBe('2021-10-20T00:53:32-06:00')
  })
  
  test('handles seats with null last_activity_at', () => {
    const seatsWithNullActivity = [
      {
        assignee: { login: 'user1', id: 1 },
        assigning_team: { name: 'Team A' },
        created_at: '2021-08-03T18:00:00-06:00',
        last_activity_at: null,
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
      },
      {
        assignee: { login: 'user1', id: 1 },
        assigning_team: { name: 'Team B' },
        created_at: '2021-08-04T18:00:00-06:00',
        last_activity_at: '2021-10-15T00:53:32-06:00',
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
      }
    ]
    
    const seats = seatsWithNullActivity.map(data => new Seat(data))
    
    const deduplicate = (seats: Seat[]): Seat[] => {
      const uniqueSeats = new Map<number, Seat>()
      
      for (const seat of seats) {
        const existingSeat = uniqueSeats.get(seat.id)
        if (!existingSeat) {
          uniqueSeats.set(seat.id, seat)
        } else {
          // Keep the one with more recent activity, treat null as earliest date
          const seatActivity = seat.last_activity_at || '1970-01-01T00:00:00Z'
          const existingActivity = existingSeat.last_activity_at || '1970-01-01T00:00:00Z'
          
          if (seatActivity > existingActivity) {
            uniqueSeats.set(seat.id, seat)
          }
        }
      }
      
      return Array.from(uniqueSeats.values())
    }
    
    const deduplicatedSeats = deduplicate(seats)
    
    expect(deduplicatedSeats).toHaveLength(1)
    expect(deduplicatedSeats[0].team).toBe('Team B')
    expect(deduplicatedSeats[0].last_activity_at).toBe('2021-10-15T00:53:32-06:00')
  })
})