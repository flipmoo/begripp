/**
 * Common date utility functions
 *
 * This module contains all date-related utility functions used throughout the application.
 * It consolidates functionality from multiple date utility files to provide a single source of truth.
 */
import { getWeek } from 'date-fns';

export type ViewType = 'week' | 'month' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ViewParams {
  year: number;
  week?: number;
  month?: number;
}

/**
 * Normalizes a date to YYYY-MM-DD format
 * @param date The date to normalize
 * @returns Date string in YYYY-MM-DD format
 */
export function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the ISO week number for a given date
 * @param date The date to get the week number for
 * @returns The ISO week number (1-53)
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
}

/**
 * Gets the start and end dates of a week according to ISO-8601 standard
 * Week 1 is the week containing the first Thursday of the year
 * @param year The year
 * @param week The ISO week number
 * @returns Object with startDate and endDate strings in YYYY-MM-DD format
 */
export function getWeekDates(year: number, week: number): { startDate: string, endDate: string } {
  // Find the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);

  // Find the first Thursday of the year
  const firstThursday = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();

  // If the first day is after Thursday, move to next week
  if (dayOfWeek > 4) {
    firstThursday.setDate(firstDayOfYear.getDate() + (7 - dayOfWeek) + 4);
  }
  // Otherwise, move to this week's Thursday
  else {
    firstThursday.setDate(firstDayOfYear.getDate() + (4 - dayOfWeek));
  }

  // Find the Monday of the week containing the first Thursday (start of week 1)
  const firstMondayOfWeek1 = new Date(firstThursday);
  firstMondayOfWeek1.setDate(firstThursday.getDate() - 3);

  // Calculate the first day of the requested week
  const firstDayOfRequestedWeek = new Date(firstMondayOfWeek1);
  firstDayOfRequestedWeek.setDate(firstMondayOfWeek1.getDate() + (week - 1) * 7);

  // Calculate the last day of the requested week (6 days after the first day)
  const lastDayOfRequestedWeek = new Date(firstDayOfRequestedWeek);
  lastDayOfRequestedWeek.setDate(firstDayOfRequestedWeek.getDate() + 6);

  // Return the normalized dates
  return {
    startDate: normalizeDate(firstDayOfRequestedWeek),
    endDate: normalizeDate(lastDayOfRequestedWeek)
  };
}

/**
 * Get an array of dates for each day in a week
 * @param year The year
 * @param week The ISO week number
 * @returns Array of Date objects for each day in the week (Monday to Sunday)
 */
export function getWeekDays(year: number, week: number): Date[] {
  // Calculate the first day of the requested week using getWeekDates
  const { startDate } = getWeekDates(year, week);
  const firstDayOfRequestedWeek = new Date(startDate);

  // Generate all days of the week
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(firstDayOfRequestedWeek);
    day.setDate(firstDayOfRequestedWeek.getDate() + i);
    weekDays.push(day);
  }

  return weekDays;
}

/**
 * Format a date to a human-readable string
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get the name of the month
 * @param monthIndex The month index (0-11)
 * @returns The name of the month
 */
export function getMonthName(monthIndex: number): string {
  const date = new Date();
  date.setMonth(monthIndex);
  return date.toLocaleDateString('nl-NL', { month: 'long' });
}

/**
 * Get a date range for a specific view (week, month, year)
 * @param view The view type
 * @param params The view parameters
 * @returns Object with start and end dates
 */
export function getDateRangeForView(view: ViewType, params: ViewParams): DateRange {
  switch (view) {
    case 'week': {
      if (typeof params.week !== 'number') {
        throw new Error('Week parameter is required for week view');
      }

      const { startDate, endDate } = getWeekDates(params.year, params.week);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    }

    case 'month': {
      if (typeof params.month !== 'number') {
        throw new Error('Month parameter is required for month view');
      }

      const startDate = new Date(Date.UTC(params.year, params.month, 1));
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(Date.UTC(params.year, params.month + 1, 0));
      endDate.setUTCHours(23, 59, 59, 999);

      return { start: startDate, end: endDate };
    }

    case 'year': {
      const startDate = new Date(Date.UTC(params.year, 0, 1));
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(Date.UTC(params.year, 11, 31));
      endDate.setUTCHours(23, 59, 59, 999);

      return { start: startDate, end: endDate };
    }

    default:
      throw new Error(`Unsupported view type: ${view}`);
  }
}