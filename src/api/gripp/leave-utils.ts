export function calculateLeaveHours(
  employeeId: number,
  absences: Absence[],
  startDate: string,
  endDate: string,
  holidays: Holiday[]
): number {
  // Filter absences for this employee
  const employeeAbsences = absences.filter(absence => {
    const match = absence.employee_id === employeeId;
    return match;
  });
  
  if (employeeAbsences.length === 0) {
    return 0;
  }
  
  // Calculate total leave hours
  let totalLeaveHours = 0;
  
  for (const absence of employeeAbsences) {
    // Convert dates to Date objects
    const absenceStart = new Date(absence.startdate);
    const absenceEnd = new Date(absence.enddate);
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    
    // Check if the absence overlaps with the period
    const overlaps = absenceStart <= periodEnd && absenceEnd >= periodStart;
    
    if (!overlaps) {
      continue;
    }
    
    // Calculate the overlap period
    const overlapStart = new Date(Math.max(absenceStart.getTime(), periodStart.getTime()));
    const overlapEnd = new Date(Math.min(absenceEnd.getTime(), periodEnd.getTime()));
    
    // Calculate the number of weekdays in the overlap period
    let weekdaysCount = 0;
    let currentDate = new Date(overlapStart);
    
    while (currentDate <= overlapEnd) {
      const dayOfWeek = currentDate.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if it's a holiday
        const isHoliday = holidays.some(holiday => {
          const holidayDate = new Date(holiday.date);
          return holidayDate.getFullYear() === currentDate.getFullYear() &&
                 holidayDate.getMonth() === currentDate.getMonth() &&
                 holidayDate.getDate() === currentDate.getDate();
        });
        
        if (!isHoliday) {
          weekdaysCount++;
        }
      }
      
      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate leave hours for this absence
    const absenceLeaveHours = weekdaysCount * absence.hours_per_day;
    
    totalLeaveHours += absenceLeaveHours;
  }
  
  return totalLeaveHours;
} 