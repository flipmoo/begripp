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

export function getDateRangeForView(view: ViewType, params: ViewParams): DateRange {
  switch (view) {
    case 'week': {
      if (typeof params.week !== 'number') {
        throw new Error('Week parameter is required for week view');
      }
      
      // Get the first day of the year in UTC
      const firstDayOfYear = new Date(Date.UTC(params.year, 0, 1));
      
      // Get the first Monday of the year
      const firstMonday = new Date(firstDayOfYear);
      const firstDayOfWeek = firstDayOfYear.getUTCDay() || 7; // Convert Sunday (0) to 7
      firstMonday.setUTCDate(firstDayOfYear.getUTCDate() + (8 - firstDayOfWeek));
      
      // Calculate the start date by adding the required number of weeks
      const startDate = new Date(firstMonday);
      startDate.setUTCDate(firstMonday.getUTCDate() + (params.week - 1) * 7);
      startDate.setUTCHours(0, 0, 0, 0);
      
      // Calculate end date (Sunday)
      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      endDate.setUTCHours(23, 59, 59, 999);
      
      return { start: startDate, end: endDate };
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