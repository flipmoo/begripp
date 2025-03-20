import { format } from 'date-fns';

// Use the same API base URL as in employee.service.ts
const API_BASE = 'http://localhost:3002/api';

export interface Absence {
  id: number;
  employee: {
    id: number;
    name: string;
  };
  startdate: string;
  enddate: string;
  type: {
    id: number;
    name: string;
  };
  hours_per_day: number;
  description: string;
  status: {
    id: number;
    name: string;
  };
}

export interface AbsencesByEmployee {
  [employeeId: number]: Absence[];
}

export interface AbsencesByDate {
  [date: string]: {
    [employeeId: number]: Absence;
  };
}

export async function getAbsences(year: number, week: number): Promise<Absence[]> {
  try {
    // Calculate start and end dates for the week
    const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
    const dayOfWeek = firstDayOfYear.getUTCDay() || 7; // Convert Sunday (0) to 7
    const firstMonday = new Date(firstDayOfYear);
    firstMonday.setUTCDate(firstDayOfYear.getUTCDate() + (8 - dayOfWeek));
    
    const startDate = new Date(firstMonday);
    startDate.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
    
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    console.log(`Fetching absences for week ${week} of ${year} (${formattedStartDate} to ${formattedEndDate})`);
    
    const response = await fetch(`${API_BASE}/absences?startDate=${formattedStartDate}&endDate=${formattedEndDate}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch absence data');
    }
    
    const absences: Absence[] = await response.json();
    return absences;
  } catch (error) {
    console.error('Error fetching absences:', error);
    throw error;
  }
}

export function groupAbsencesByEmployee(absences: Absence[]): AbsencesByEmployee {
  return absences.reduce((grouped, absence) => {
    const employeeId = absence.employee.id;
    if (!grouped[employeeId]) {
      grouped[employeeId] = [];
    }
    grouped[employeeId].push(absence);
    return grouped;
  }, {} as AbsencesByEmployee);
}

export function groupAbsencesByDate(absences: Absence[]): AbsencesByDate {
  const result: AbsencesByDate = {};
  
  absences.forEach(absence => {
    const startDate = new Date(absence.startdate);
    const endDate = new Date(absence.enddate);
    const currentDate = new Date(startDate);
    
    // For each day in the absence period
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      if (!result[dateStr]) {
        result[dateStr] = {};
      }
      
      result[dateStr][absence.employee.id] = absence;
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return result;
} 