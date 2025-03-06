/**
 * Normalizes a date to YYYY-MM-DD format
 */
export function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Gets the start and end dates of a week according to ISO-8601 standard
 * Week 1 is the week containing the first Thursday of the year
 */
export function getWeekDates(year: number, week: number): { startDate: string, endDate: string } {
  // Find the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Find the first Thursday of the year
  const firstThursday = new Date(year, 0, 1);
  // 4 = Thursday (0 = Sunday, 1 = Monday, etc.)
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