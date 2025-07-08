// @vitest-environment node
import { describe, test, expect } from 'vitest'
import Holidays from 'date-holidays'

describe('date-holidays integration', () => {
  test('correctly identifies US holidays', () => {
    const holidays = new Holidays('US')
    // Use actual US holidays for 2023
    const newYearsDay = new Date('2023-01-01')
    const christmas = new Date('2023-12-25')
    const regularDay = new Date('2023-01-15') // Regular day in January

    expect(holidays.isHoliday(newYearsDay)).toBeTruthy()
    expect(holidays.isHoliday(christmas)).toBeTruthy()
    expect(holidays.isHoliday(regularDay)).toBeFalsy()
  })

  test('correctly identifies German holidays', () => {
    const holidays = new Holidays('DE')
    const newYearsDay = new Date('2023-01-01')
    const christmas = new Date('2023-12-25')
    const regularDay = new Date('2023-01-15') // Regular day in January

    expect(holidays.isHoliday(newYearsDay)).toBeTruthy()
    expect(holidays.isHoliday(christmas)).toBeTruthy()
    expect(holidays.isHoliday(regularDay)).toBeFalsy()
  })

  test('handles invalid locale gracefully', () => {
    expect(() => new Holidays('INVALID')).not.toThrow()
  })

  test('isHoliday returns array when holiday exists', () => {
    const holidays = new Holidays('US')
    const christmas = new Date('2023-12-25')
    const result = holidays.isHoliday(christmas)
    
    expect(Array.isArray(result)).toBe(true)
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('name')
    expect(result[0].name).toContain('Christmas')
  })

  test('isHoliday returns false for non-holiday', () => {
    const holidays = new Holidays('US')
    const regularDay = new Date('2023-01-15') // Regular day in January
    const result = holidays.isHoliday(regularDay)
    
    expect(result).toBeFalsy()
  })
})