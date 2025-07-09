import Holidays from 'date-holidays';
import type { CopilotMetrics } from "@/model/Copilot_Metrics";

export function filterHolidaysFromMetrics(data: CopilotMetrics[], excludeHolidays: boolean, locale?: string): CopilotMetrics[] {
    if (!excludeHolidays || !locale) {
        return data;
    }

    return data.filter(metric => {
        if (!metric.date) return true;

        try {
            const date = parseUtcDate(metric.date);
            return !isHoliday(date, locale);
        } catch (error) {
            // If date parsing fails, keep the entry
            console.warn('Error parsing date:', metric.date, error);
            return true;
        }
    });
}

export function isHoliday(date: Date, locale: string): boolean {
    try {
        if (isWeekend(date)) {
            return true; // Treat weekends as holidays
        }
        const holidays = new Holidays(locale);
        const result = holidays.isHoliday(date);
        // holidays.isHoliday returns false for no holiday, or an array for holidays
        return result && Array.isArray(result) && result.length > 0;
    } catch (error) {
        // If locale is invalid or error occurs, fallback to no holidays
        console.warn(`Invalid locale ${locale} or error checking holidays:`, error);
        return false;
    }
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Parse a date string in UTC to avoid timezone-dependent issues
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object parsed in UTC
 */
export function parseUtcDate(dateString: string): Date {
    // For YYYY-MM-DD format, parse as noon UTC to avoid timezone issues
    // This ensures consistent day-of-week calculation regardless of server timezone
    const utcDateString = `${dateString}T12:00:00Z`;
    return new Date(utcDateString);
}