import { create } from 'zustand';
import { getDateRangeForView } from '../utils/date';

// Use the same API base URL as in employee.service.ts
const API_BASE = 'http://localhost:3002/api';

type AbsenceHours = {
  [employeeId: number]: {
    [date: string]: {
      hours: number;
      type: string;
      description: string;
    };
  };
};

// Define the Absence type to match the API response
interface Absence {
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

interface AbsenceState {
  absenceHours: AbsenceHours;
  isLoading: boolean;
  error: string | null;
  currentWeek: number | null;
  currentYear: number | null;
  fetchAbsenceHours: (employeeIds: number[], year: number, week: number) => Promise<void>;
}

export const useAbsenceStore = create<AbsenceState>((set, get) => ({
  absenceHours: {},
  isLoading: false,
  error: null,
  currentWeek: null,
  currentYear: null,

  fetchAbsenceHours: async (employeeIds: number[], year: number, week: number) => {
    // Skip if already loading or if we're fetching the same week
    const state = get();
    if (state.isLoading || (state.currentWeek === week && state.currentYear === year)) {
      return;
    }

    try {
      set(() => ({ isLoading: true, error: null }));

      // Get date range for the week
      const { start, end } = getDateRangeForView('week', { year, week });

      // Format dates to YYYY-MM-DD
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];

      // Fetch absence data directly from the API
      console.log(`Fetching absences for week ${week} of ${year} (${startDate} to ${endDate})`);
      const response = await fetch(`${API_BASE}/absences?startDate=${startDate}&endDate=${endDate}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch absence data');
      }
      
      const absences = await response.json();

      // Process responses into AbsenceHours structure
      const absenceHours: AbsenceHours = {};

      responses.forEach(response => {
        if (!response.result?.rows?.length) return;

        response.result.rows.forEach((absence: AbsenceRequest) => {
          const employeeId = absence.employee.id;
          if (!absenceHours[employeeId]) {
            absenceHours[employeeId] = {};
          }

        // Get the date from the absence
        const dateStr = absence.startdate.split('T')[0];
        
        // If there's already an absence for this day, only override if the current one has more hours
        const existingAbsence = absenceHours[employeeId][dateStr];
        if (!existingAbsence || existingAbsence.hours < absence.hours_per_day) {
          absenceHours[employeeId][dateStr] = {
            hours: absence.hours_per_day,
            type: absence.type.name,
            description: absence.description,
          };
        }
      });

      // Replace the entire state instead of merging
      set({
        absenceHours,
        isLoading: false,
        currentWeek: week,
        currentYear: year,
        error: null
      });
    } catch (error) {
      console.error('Error fetching absence hours:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch absence hours',
        isLoading: false,
        currentWeek: null,
        currentYear: null
      });
    }
  },
})); 