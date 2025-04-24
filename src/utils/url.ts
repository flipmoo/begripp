/**
 * Utility functions for generating URLs with filter parameters
 */
import { getWeek, getYear, getMonth } from 'date-fns';

interface FilterParams {
  year?: number;
  week?: number;
  month?: number;
  viewMode?: 'week' | 'month';
  search?: string;
  active?: boolean;
  minPercentage?: number;
  maxPercentage?: number;
  sortBy?: 'percentage' | 'name';
  sortDirection?: 'asc' | 'desc';
  excluded?: number[];
  preset?: string;
}

/**
 * Generate a URL for the employees table view with the specified filters
 */
export function generateEmployeesUrl(filters: FilterParams): string {
  return generateUrl('/employees', filters);
}

/**
 * Generate a URL for the employees cards view with the specified filters
 */
export function generateEmployeeCardsUrl(filters: FilterParams): string {
  return generateUrl('/employees/cards', filters);
}

/**
 * Generate a URL with the specified base path and filter parameters
 */
function generateUrl(basePath: string, filters: FilterParams): string {
  const params = new URLSearchParams();

  // Add all filters that are defined
  if (filters.year !== undefined) {
    params.set('year', filters.year.toString());
  }

  if (filters.viewMode === 'week' && filters.week !== undefined) {
    params.set('week', filters.week.toString());
  } else if (filters.viewMode === 'month' && filters.month !== undefined) {
    params.set('month', filters.month.toString());
  }

  if (filters.viewMode) {
    params.set('viewMode', filters.viewMode);
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  if (filters.active !== undefined) {
    params.set('active', filters.active.toString());
  }

  if (filters.minPercentage !== undefined && filters.minPercentage !== 0) {
    params.set('minPercentage', filters.minPercentage.toString());
  }

  if (filters.maxPercentage !== undefined && filters.maxPercentage !== 200) {
    params.set('maxPercentage', filters.maxPercentage.toString());
  }

  if (filters.excluded && filters.excluded.length > 0) {
    params.set('excluded', filters.excluded.join(','));
  }

  if (filters.preset) {
    params.set('preset', filters.preset);
  }

  if (filters.sortBy && filters.sortBy !== 'percentage') {
    params.set('sortBy', filters.sortBy);
  }

  if (filters.sortDirection && filters.sortDirection !== 'desc') {
    params.set('sortDirection', filters.sortDirection);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

