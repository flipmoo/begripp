import { normalizeDate } from './date-utils';

/**
 * Calculates leave hours for an employee for a specific week
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
  
  console.log(`Employee ${employeeId} has ${employeeAbsences.length} absences for the period ${startDate} to ${endDate}`);
  
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
    
    console.log(`Checking absence from ${absence.startdate} to ${absence.enddate} (${absence.hours_per_day} hours per day)`);
    
    // Check if this absence overlaps with the week
    const weekStart = new Date(startDate);
    const weekEnd = new Date(endDate);
    weekEnd.setHours(23, 59, 59, 999);
    
    const overlaps = absenceStart <= weekEnd && absenceEnd >= weekStart;
    
    console.log(`Absence overlaps with week? ${overlaps}`);
    
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
        
        console.log(`Date ${dateString} - Weekend: ${isWeekend}, Holiday: ${isHoliday}, Within week: ${isWithinWeek}`);
        
        // Add hours if it's a weekday, not a holiday, and within the week
        if (!isWeekend && !isHoliday && isWithinWeek) {
          // Simply use the hours_per_day from the absence record
          leaveHours += absence.hours_per_day;
          console.log(`Adding ${absence.hours_per_day} hours for ${dateString}, total: ${leaveHours}`);
        }
        
        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }
  
  console.log(`Total leave hours for employee ${employeeId}: ${leaveHours}`);
  return leaveHours;
} 