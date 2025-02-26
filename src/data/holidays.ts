export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export const defaultHolidays: Holiday[] = [
  { id: '1', date: '2025-01-01', name: 'New Year' },
  { id: '2', date: '2025-04-18', name: 'Good Friday' },
  { id: '3', date: '2025-04-21', name: 'Easter' },
  { id: '4', date: '2025-04-26', name: 'Kingsdag' },
  { id: '5', date: '2025-05-05', name: 'Liberation Day' },
  { id: '6', date: '2025-05-29', name: 'Ascension Day' },
  { id: '7', date: '2025-06-08', name: '1st day of Pentecost' },
  { id: '8', date: '2025-06-09', name: '2nd day of Pentecost' },
  { id: '9', date: '2025-12-25', name: 'Christmas' },
  { id: '10', date: '2025-12-26', name: 'Christmas' },
];

// Function to get holidays within a date range
export function getHolidaysInRange(startDate: Date, endDate: Date, holidays: Holiday[] = defaultHolidays): Holiday[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  
  return holidays.filter(holiday => {
    const holidayDate = new Date(holiday.date).getTime();
    return holidayDate >= start && holidayDate <= end;
  });
}

// Function to check if a date is a holiday
export function isHoliday(date: Date, holidays: Holiday[] = defaultHolidays): boolean {
  const dateString = date.toISOString().split('T')[0];
  return holidays.some(holiday => holiday.date === dateString);
}

// Function to get working hours for a specific day, taking holidays into account
export function getWorkingHoursForDay(
  date: Date,
  contract: {
    hours_monday_even?: number;
    hours_monday_odd?: number;
    hours_tuesday_even?: number;
    hours_tuesday_odd?: number;
    hours_wednesday_even?: number;
    hours_wednesday_odd?: number;
    hours_thursday_even?: number;
    hours_thursday_odd?: number;
    hours_friday_even?: number;
    hours_friday_odd?: number;
  },
  isEvenWeek: boolean,
  holidays: Holiday[] = defaultHolidays
): number {
  // Create a new date object to avoid mutating input
  const dateToCheck = new Date(date);
  // Set to midnight UTC
  dateToCheck.setUTCHours(0, 0, 0, 0);
  
  // Check if the date is a holiday using UTC time
  if (holidays.some(holiday => {
    const holidayDate = new Date(holiday.date);
    holidayDate.setUTCHours(0, 0, 0, 0);
    // Compare full ISO date strings for exact match
    return holidayDate.toISOString().split('T')[0] === dateToCheck.toISOString().split('T')[0];
  })) {
    return 0;
  }

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Return hours based on the day and whether it's an even/odd week
  // Use nullish coalescing to handle undefined values
  switch (dayOfWeek) {
    case 1: // Monday
      return isEvenWeek ? (contract.hours_monday_even ?? 0) : (contract.hours_monday_odd ?? 0);
    case 2: // Tuesday
      return isEvenWeek ? (contract.hours_tuesday_even ?? 0) : (contract.hours_tuesday_odd ?? 0);
    case 3: // Wednesday
      return isEvenWeek ? (contract.hours_wednesday_even ?? 0) : (contract.hours_wednesday_odd ?? 0);
    case 4: // Thursday
      return isEvenWeek ? (contract.hours_thursday_even ?? 0) : (contract.hours_thursday_odd ?? 0);
    case 5: // Friday
      return isEvenWeek ? (contract.hours_friday_even ?? 0) : (contract.hours_friday_odd ?? 0);
    default: // Weekend days (Saturday = 6, Sunday = 0)
      return 0;
  }
} 