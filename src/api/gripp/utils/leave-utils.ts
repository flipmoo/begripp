import { normalizeDate } from '../../../utils/date-utils';

/**
 * Calculates leave hours for an employee for a specific week
 *
 * @param employeeId - The ID of the employee
 * @param absences - Array of absence records
 * @param startDate - Start date of the period to calculate (YYYY-MM-DD)
 * @param endDate - End date of the period to calculate (YYYY-MM-DD)
 * @param holidays - Array of holiday records
 * @returns Total leave hours for the employee in the specified period
 */
export function calculateLeaveHours(
  employeeId: number,
  absences: Array<{
    employee_id: number;
    startdate: string;
    enddate: string;
    hours_per_day: number;
    type_name: string;
    description: string;
    status_name: string;
  }>,
  startDate: string,
  endDate: string,
  holidays: Array<{ date: string; name: string }>
): number {
  // Filter absences for this employee
  const employeeAbsences = absences.filter(a => a.employee_id === employeeId);

  // If no absences, return 0
  if (employeeAbsences.length === 0) {
    return 0;
  }

  // Create a set of holiday dates for quick lookup
  const holidayDates = new Set(holidays.map(h => h.date));

  // Initialize leave hours
  let leaveHours = 0;

  // Process each absence
  for (const absence of employeeAbsences) {
    // Convert absence dates to Date objects
    const absenceStart = new Date(absence.startdate);
    const absenceEnd = new Date(absence.enddate);

    // Check if this absence overlaps with the week
    const weekStart = new Date(startDate);
    const weekEnd = new Date(endDate);
    weekEnd.setHours(23, 59, 59, 999);

    const overlaps = absenceStart <= weekEnd && absenceEnd >= weekStart;

    if (overlaps) {
      // Process each day in the absence period
      const currentDate = new Date(absenceStart);

      while (currentDate <= absenceEnd) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dateString = normalizeDate(currentDate);

        // Skip weekends
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Skip holidays
        const isHoliday = holidayDates.has(dateString);

        // Check if the date is within the week
        const isWithinWeek = currentDate >= weekStart && currentDate <= weekEnd;

        // Add hours if it's a weekday, not a holiday, and within the week
        if (!isWeekend && !isHoliday && isWithinWeek) {
          // Simply use the hours_per_day from the absence record
          leaveHours += absence.hours_per_day;
        }

        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  return leaveHours;
}