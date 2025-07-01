// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { Seat } from '@/model/Seat'

describe('Seat.ts', () => {
  test('handles normal seat data with assignee', () => {
    const seatData = {
      assignee: {
        login: 'octocat',
        id: 123
      },
      assigning_team: {
        name: 'Justice League'
      },
      created_at: '2021-08-03T18:00:00-06:00',
      last_activity_at: '2021-10-14T00:53:32-06:00',
      last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
    }

    const seat = new Seat(seatData)

    expect(seat.login).toBe('octocat')
    expect(seat.id).toBe(123)
    expect(seat.team).toBe('Justice League')
    expect(seat.created_at).toBe('2021-08-03T18:00:00-06:00')
    expect(seat.last_activity_at).toBe('2021-10-14T00:53:32-06:00')
    expect(seat.last_activity_editor).toBe('vscode/1.77.3/copilot/1.86.82')
  })

  test('handles seat data without assigning_team', () => {
    const seatData = {
      assignee: {
        login: 'octocat',
        id: 123
      },
      assigning_team: null,
      created_at: '2021-08-03T18:00:00-06:00',
      last_activity_at: '2021-10-14T00:53:32-06:00',
      last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
    }

    const seat = new Seat(seatData)

    expect(seat.login).toBe('octocat')
    expect(seat.id).toBe(123)
    expect(seat.team).toBe('')
    expect(seat.created_at).toBe('2021-08-03T18:00:00-06:00')
    expect(seat.last_activity_at).toBe('2021-10-14T00:53:32-06:00')
    expect(seat.last_activity_editor).toBe('vscode/1.77.3/copilot/1.86.82')
  })

  test('handles seat data with null assignee - should not throw error', () => {
    const seatData = {
      assignee: null,
      assigning_team: {
        name: 'Justice League'
      },
      created_at: '2021-08-03T18:00:00-06:00',
      last_activity_at: '2021-10-14T00:53:32-06:00',
      last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
    }

    // This should not throw an error after the fix
    expect(() => new Seat(seatData)).not.toThrow()

    const seat = new Seat(seatData)

    // Should use fallback values for null assignee
    expect(seat.login).toBe('deprecated')
    expect(seat.id).toBe(0)
    expect(seat.team).toBe('Justice League')
    expect(seat.created_at).toBe('2021-08-03T18:00:00-06:00')
    expect(seat.last_activity_at).toBe('2021-10-14T00:53:32-06:00')
    expect(seat.last_activity_editor).toBe('vscode/1.77.3/copilot/1.86.82')
  })

  test('handles seat data with null assignee and null assigning_team', () => {
    const seatData = {
      assignee: null,
      assigning_team: null,
      created_at: '2021-08-03T18:00:00-06:00',
      last_activity_at: '2021-10-14T00:53:32-06:00',
      last_activity_editor: 'vscode/1.77.3/copilot/1.86.82'
    }

    // This should not throw an error after the fix
    expect(() => new Seat(seatData)).not.toThrow()

    const seat = new Seat(seatData)

    // Should use fallback values for both null fields
    expect(seat.login).toBe('deprecated')
    expect(seat.id).toBe(0)
    expect(seat.team).toBe('')
    expect(seat.created_at).toBe('2021-08-03T18:00:00-06:00')
    expect(seat.last_activity_at).toBe('2021-10-14T00:53:32-06:00')
    expect(seat.last_activity_editor).toBe('vscode/1.77.3/copilot/1.86.82')
  })

  test('handles mock data with null assignee like in organization_seats_response_sample.json', () => {
    // This simulates the exact structure from our updated mock data
    const seatDataFromMock = {
      "created_at": "2021-09-23T18:00:00-06:00",
      "updated_at": "2021-09-23T15:00:00-06:00", 
      "pending_cancellation_date": "2021-11-01",
      "last_activity_at": "2021-10-12T00:53:32-06:00",
      "last_activity_editor": "vscode/1.77.3/copilot/1.86.82",
      "assignee": null,
      "assigning_team": {
        "id": 1,
        "name": "Justice League",
        "slug": "justice-league"
      }
    }

    expect(() => new Seat(seatDataFromMock)).not.toThrow()

    const seat = new Seat(seatDataFromMock)

    expect(seat.login).toBe('deprecated')
    expect(seat.id).toBe(0)
    expect(seat.team).toBe('Justice League')
  })
})