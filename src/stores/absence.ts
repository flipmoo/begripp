import { create } from 'zustand';
import { absenceService, AbsenceRequest } from '../api/gripp/services/absence';
import { getDateRangeForView } from '../utils/date';

type AbsenceHours = {
  [employeeId: number]: {
    [date: string]: {
      hours: number;
      type: string;
      description: string;
    };
  };
};

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

      // Fetch absence requests
      const responses = await absenceService.getByEmployeeIdsAndPeriod(
        employeeIds,
        startDate,
        endDate
      );

      // Process responses into AbsenceHours structure
      const absenceHours: AbsenceHours = {};

      responses.forEach(response => {
        if (!response.result?.rows?.length) return;

        response.result.rows.forEach((absence: AbsenceRequest) => {
          const employeeId = absence.employee.id;
          if (!absenceHours[employeeId]) {
            absenceHours[employeeId] = {};
          }

          // Convert start and end dates to Date objects
          const start = new Date(absence.startdate.date);
          const end = new Date(absence.enddate.date);

          // Ensure dates are in UTC to avoid timezone issues
          start.setUTCHours(0, 0, 0, 0);
          end.setUTCHours(0, 0, 0, 0);

          // For each day in the range, add the hours
          for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            
            // If there's already an absence for this day, only override if the current one has more hours
            const existingAbsence = absenceHours[employeeId][dateStr];
            if (!existingAbsence || existingAbsence.hours < absence.hours_per_day) {
              absenceHours[employeeId][dateStr] = {
                hours: absence.hours_per_day,
                type: absence.type.searchname,
                description: absence.description,
              };
            }
          }
        });
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