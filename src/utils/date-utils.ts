/**
 * Common date utility functions
 */
import { getWeek } from 'date-fns';

/**
 * Get the ISO week number for a given date
 * @param date The date to get the week number for
 * @returns The ISO week number (1-53)
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
}

/**
 * Get an array of dates for each day in a week
 * @param year The year
 * @param week The ISO week number
 * @returns Array of Date objects for each day in the week (Monday to Sunday)
 */
export function getWeekDays(year: number, week: number): Date[] {
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