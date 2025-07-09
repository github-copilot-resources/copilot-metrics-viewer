import { describe, it, expect } from 'vitest';
import { isHoliday, isWeekend, parseUtcDate } from '@/utils/dateUtils';


describe('Weekend filtering debug', () => {
  it('should correctly identify weekends', () => {
    // Test the isWeekend function using parseUtcDate to avoid timezone issues
    const sunday = parseUtcDate('2025-06-15'); // Sunday
    const saturday = parseUtcDate('2025-06-14'); // Saturday
    const friday = parseUtcDate('2025-06-13'); // Friday

    expect(isWeekend(sunday)).toBe(true);
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(friday)).toBe(false);
  });

  it('should correctly identify holidays (including weekends)', () => {
    const sunday = parseUtcDate('2025-06-15'); // Sunday
    const saturday = parseUtcDate('2025-06-14'); // Saturday
    const friday = parseUtcDate('2025-06-13'); // Friday

    // Test the isHoliday function
    expect(isHoliday(sunday, 'en-US')).toBe(true); // Should be true because it's a weekend
    expect(isHoliday(saturday, 'en-US')).toBe(true); // Should be true because it's a weekend
    expect(isHoliday(friday, 'en-US')).toBe(false); // Should be false (not a weekend or holiday)
  });

  it('should check specific date 6-14-2025', () => {
    // This is the date mentioned in the issue
    const date = parseUtcDate('2025-06-14'); // Saturday
    
    console.log('Date 2025-06-14:');
    console.log('- Day of week:', date.getDay());
    console.log('- Is weekend:', isWeekend(date));
    console.log('- Is holiday:', isHoliday(date, 'en-US'));
    
    expect(isWeekend(date)).toBe(true);
    expect(isHoliday(date, 'en-US')).toBe(true);
  });

  it('should test date parsing edge cases', () => {
    // Test various date formats
    const date1 = new Date('2025-06-14'); // ISO format
    const date2 = new Date('6/14/2025'); // US format
    const date3 = new Date('June 14, 2025'); // Long format
    const date4 = new Date('2025-06-14T00:00:00'); // ISO with time
    const date5 = new Date('2025-06-14T00:00:00Z'); // ISO with UTC
    
    console.log('Date formats:');
    console.log('- ISO format (2025-06-14):', date1.toString(), 'Day:', date1.getDay());
    console.log('- US format (6/14/2025):', date2.toString(), 'Day:', date2.getDay());
    console.log('- Long format (June 14, 2025):', date3.toString(), 'Day:', date3.getDay());
    console.log('- ISO with time (2025-06-14T00:00:00):', date4.toString(), 'Day:', date4.getDay());
    console.log('- ISO with UTC (2025-06-14T00:00:00Z):', date5.toString(), 'Day:', date5.getDay());
    
    // Check what day June 14, 2025 actually is
    const correctDate = parseUtcDate('2025-06-14'); // Use parseUtcDate for consistency
    console.log('- Correct date (2025-06-14T12:00:00Z):', correctDate.toString(), 'Day:', correctDate.getDay());
    
    // According to calendar, June 14, 2025 should be a Saturday (day 6)
    // But our test shows it as Friday (day 5)
    // This suggests a timezone or date parsing issue
    
    // Let's test with a known date
    const knownSaturday = parseUtcDate('2025-01-04'); // January 4, 2025 is a Saturday
    const knownSunday = parseUtcDate('2025-01-05'); // January 5, 2025 is a Sunday
    
    console.log('- Known Saturday (2025-01-04):', knownSaturday.toString(), 'Day:', knownSaturday.getDay());
    console.log('- Known Sunday (2025-01-05):', knownSunday.toString(), 'Day:', knownSunday.getDay());
    
    expect(knownSaturday.getDay()).toBe(6);
    expect(knownSunday.getDay()).toBe(0);
  });
});
