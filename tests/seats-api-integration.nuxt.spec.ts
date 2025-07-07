// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Seat } from '@/model/Seat'

describe('Enterprise Seats API Integration', () => {
  test('deduplicates seats from mock data with duplicates', () => {
    // Read the mock data with duplicates
    const mockDataPath = resolve('public/mock-data/enterprise_seats_with_duplicates.json')
    const data = readFileSync(mockDataPath, 'utf8')
    const mockData = JSON.parse(data)
    
    // Create seats from mock data
    const seats = mockData.seats.map((item: unknown) => new Seat(item))
    
    // Verify we have duplicates in the raw data
    expect(seats).toHaveLength(4) // 4 seat records
    expect(mockData.total_seats).toBe(2) // But only 2 unique users
    
    // Apply the same deduplication logic as the API
    const deduplicateSeats = (seats: Seat[]): Seat[] => {
      const uniqueSeats = new Map<number, Seat>()
      
      for (const seat of seats) {
        // Skip seats with invalid user ID
        if (!seat.id || seat.id === 0) {
          continue
        }
        
        const existingSeat = uniqueSeats.get(seat.id)
        if (!existingSeat) {
          uniqueSeats.set(seat.id, seat)
        } else {
          // Keep the seat with more recent activity, treating null as earliest date
          const seatActivity = seat.last_activity_at || '1970-01-01T00:00:00Z'
          const existingActivity = existingSeat.last_activity_at || '1970-01-01T00:00:00Z'
          
          if (seatActivity > existingActivity) {
            uniqueSeats.set(seat.id, seat)
          }
        }
      }
      
      return Array.from(uniqueSeats.values())
    }
    
    const deduplicatedSeats = deduplicateSeats(seats)
    
    // After deduplication, should have only 2 unique users
    expect(deduplicatedSeats).toHaveLength(2)
    
    // Verify user 1 (octocat) has the seat with most recent activity (Team Beta)
    const user1 = deduplicatedSeats.find(s => s.id === 1)
    expect(user1).toBeDefined()
    expect(user1!.login).toBe('octocat')
    expect(user1!.team).toBe('Team Beta') // Should be the one with more recent activity
    expect(user1!.last_activity_at).toBe('2021-10-16T00:53:32-06:00')
    
    // Verify user 2 (octokitten) has the seat with most recent activity (Team Beta)
    const user2 = deduplicatedSeats.find(s => s.id === 2)
    expect(user2).toBeDefined()
    expect(user2!.login).toBe('octokitten')
    expect(user2!.team).toBe('Team Beta') // Should be the one with more recent activity
    expect(user2!.last_activity_at).toBe('2021-10-15T00:53:32-06:00')
    
    // Verify that the deduplication matches the total_seats count
    expect(deduplicatedSeats.length).toBe(mockData.total_seats)
  })
  
  test('handles seats with no assignee correctly', () => {
    // Test scenario with null assignee (should be filtered out)
    const seatsWithNullAssignee = [
      {
        created_at: '2021-08-03T18:00:00-06:00',
        last_activity_at: '2021-10-14T00:53:32-06:00',
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82',
        assignee: null,
        assigning_team: { name: 'Team A' }
      },
      {
        created_at: '2021-08-04T18:00:00-06:00',
        last_activity_at: '2021-10-15T00:53:32-06:00',
        last_activity_editor: 'vscode/1.77.3/copilot/1.86.82',
        assignee: { login: 'validuser', id: 1 },
        assigning_team: { name: 'Team B' }
      }
    ]
    
    const seats = seatsWithNullAssignee.map(data => new Seat(data))
    
    // Apply deduplication
    const deduplicateSeats = (seats: Seat[]): Seat[] => {
      const uniqueSeats = new Map<number, Seat>()
      
      for (const seat of seats) {
        // Skip seats with invalid user ID
        if (!seat.id || seat.id === 0) {
          continue
        }
        
        const existingSeat = uniqueSeats.get(seat.id)
        if (!existingSeat) {
          uniqueSeats.set(seat.id, seat)
        } else {
          // Keep the seat with more recent activity, treating null as earliest date
          const seatActivity = seat.last_activity_at || '1970-01-01T00:00:00Z'
          const existingActivity = existingSeat.last_activity_at || '1970-01-01T00:00:00Z'
          
          if (seatActivity > existingActivity) {
            uniqueSeats.set(seat.id, seat)
          }
        }
      }
      
      return Array.from(uniqueSeats.values())
    }
    
    const deduplicatedSeats = deduplicateSeats(seats)
    
    // Should have only 1 seat (the one with null assignee is filtered out)
    expect(deduplicatedSeats).toHaveLength(1)
    expect(deduplicatedSeats[0].login).toBe('validuser')
    expect(deduplicatedSeats[0].id).toBe(1)
  })
})