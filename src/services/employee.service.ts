import { format } from 'date-fns';
import { Absence, AbsencesByEmployee } from './absence.service';

export interface EmployeeWithStats {
    id: number;
    name: string;
    function?: string;
    contractPeriod?: string;
    contractHours?: number;
    holidayHours?: number;
    expectedHours: number;
    leaveHours: number;
    writtenHours: number;
    actualHours: number;
    absences?: Absence[];
    active?: boolean;
}

interface ApiEmployee {
    id: number;
    name: string;
    function?: string;
    contract_period?: string;
    contract_hours?: number;
    holiday_hours?: number;
    expected_hours?: number;
    actual_hours?: number;
    leave_hours?: number;
    written_hours?: number;
    active?: boolean;
}

// Use proxy URL instead of direct API URL
const API_BASE = 'http://localhost:3002/api';

// Client-side cache implementation
interface ClientCache {
  [key: string]: {
    data: EmployeeWithStats[];
    timestamp: number;
  }
}

// Cache expiration time in milliseconds (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Initialize client-side cache
const clientCache: ClientCache = {};

// Cache keys
const CLIENT_CACHE_KEYS = {
  EMPLOYEES_WEEK: (year: number, week: number) => `employees_week_${year}_${week}`,
  EMPLOYEES_MONTH: (year: number, month: number) => `employees_month_${year}_${month}`,
};

/**
 * Check if data for a specific period is in the cache and not expired
 */
export function isDataCached(year: number, week?: number, month?: number): boolean {
  const now = Date.now();
  let cacheKey;
  
  if (week !== undefined) {
    cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_WEEK(year, week);
  } else if (month !== undefined) {
    cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_MONTH(year, month);
  } else {
    return false;
  }
  
  return !!(clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION);
}

/**
 * Preload data for adjacent periods to improve user experience when navigating
 */
export async function preloadAdjacentPeriods(year: number, week?: number, month?: number): Promise<void> {
  // Don't preload if we're already loading data
  if (document.hidden) return;
  
  try {
    if (week !== undefined) {
      // Preload previous and next week
      const prevWeek = week === 1 ? 52 : week - 1;
      const prevYear = week === 1 ? year - 1 : year;
      const nextWeek = week === 52 ? 1 : week + 1;
      const nextYear = week === 52 ? year + 1 : year;
      
      // Check if we already have these in cache
      if (!isDataCached(prevYear, prevWeek)) {
        console.log(`Preloading data for year=${prevYear}, week=${prevWeek}`);
        getEmployeeStats(prevYear, prevWeek, undefined, false, true);
      }
      
      if (!isDataCached(nextYear, nextWeek)) {
        console.log(`Preloading data for year=${nextYear}, week=${nextWeek}`);
        getEmployeeStats(nextYear, nextWeek, undefined, false, true);
      }
    } else if (month !== undefined) {
      // Preload previous and next month
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      
      // Check if we already have these in cache
      if (!isDataCached(prevYear, undefined, prevMonth)) {
        console.log(`Preloading data for year=${prevYear}, month=${prevMonth}`);
        getEmployeeMonthStats(prevYear, prevMonth, undefined, false, true);
      }
      
      if (!isDataCached(nextYear, undefined, nextMonth)) {
        console.log(`Preloading data for year=${nextYear}, month=${nextMonth}`);
        getEmployeeMonthStats(nextYear, nextMonth, undefined, false, true);
      }
    }
  } catch (error) {
    console.error('Error preloading adjacent periods:', error);
    // Don't throw error for preloading
  }
}

/**
 * Get employee statistics for a specific week
 * This is now a wrapper around getEmployeeMonthStats to ensure consistent data structure
 */
export async function getEmployeeStats(
  year: number, 
  week: number, 
  timestamp?: number, 
  forceRefresh = false,
  isPreloading = false
): Promise<EmployeeWithStats[]> {
  try {
    const cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_WEEK(year, week);
    const now = Date.now();
    
    // Check if we have valid cached data
    if (!forceRefresh && clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      console.log(`Using client-side cached data for year=${year}, week=${week}`);
      
      // If this is not a preloading request, preload adjacent periods
      if (!isPreloading) {
        // Use setTimeout to not block the main thread
        setTimeout(() => preloadAdjacentPeriods(year, week), 100);
      }
      
      return clientCache[cacheKey].data;
    }
    
    // Always use a timestamp to prevent caching issues
    const currentTimestamp = timestamp || now;
    const url = `${API_BASE}/employees?year=${year}&week=${week}&_=${currentTimestamp}`;
    
    console.log(`Fetching from API: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch employee data');
    }
    
    const data: ApiEmployee[] = await response.json();
    
    // Only log detailed info if not preloading
    if (!isPreloading) {
      console.log('Raw API response:', data);
    }
    
    const transformedData = data.map(employee => ({
      id: employee.id,
      name: employee.name,
      function: employee.function,
      contractPeriod: employee.contract_period,
      contractHours: employee.contract_hours,
      holidayHours: employee.holiday_hours,
      expectedHours: employee.expected_hours || 0,
      leaveHours: employee.leave_hours || 0,
      writtenHours: employee.written_hours || 0,
      actualHours: employee.actual_hours || 0,
      active: employee.active
    }));
    
    // Store in client-side cache
    clientCache[cacheKey] = {
      data: transformedData,
      timestamp: now
    };
    
    // If this is not a preloading request, preload adjacent periods
    if (!isPreloading) {
      // Use setTimeout to not block the main thread
      setTimeout(() => preloadAdjacentPeriods(year, week), 100);
    }
    
    return transformedData;
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    throw error;
  }
}

export function enrichEmployeesWithAbsences(
    employees: EmployeeWithStats[], 
    absencesByEmployee: AbsencesByEmployee
): EmployeeWithStats[] {
    return employees.map(employee => ({
        ...employee,
        absences: absencesByEmployee[employee.id] || []
    }));
}

export async function getEmployeeDetails(employeeId: number) {
    try {
        const response = await fetch(`${API_BASE}/employees/${employeeId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch employee details');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching employee details:', error);
        return null;
    }
}

/**
 * Get employee statistics for a specific month
 */
export async function getEmployeeMonthStats(
  year: number, 
  month: number, 
  timestamp?: number, 
  forceRefresh = false,
  isPreloading = false
): Promise<EmployeeWithStats[]> {
  try {
    const cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_MONTH(year, month);
    const now = Date.now();
    
    // Check if we have valid cached data
    if (!forceRefresh && clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      console.log(`Using client-side cached data for year=${year}, month=${month}`);
      
      // If this is not a preloading request, preload adjacent periods
      if (!isPreloading) {
        // Use setTimeout to not block the main thread
        setTimeout(() => preloadAdjacentPeriods(year, undefined, month), 100);
      }
      
      return clientCache[cacheKey].data;
    }
    
    // Always use a timestamp to prevent caching issues
    const currentTimestamp = timestamp || now;
    // Note: month is 0-indexed in JavaScript but 1-indexed in the API
    const url = `${API_BASE}/employees/month?year=${year}&month=${month + 1}&_=${currentTimestamp}`;
    
    console.log(`Fetching from API: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch monthly employee data');
    }
    
    const data: ApiEmployee[] = await response.json();
    
    // Only log detailed info if not preloading
    if (!isPreloading) {
      console.log('Raw monthly API response:', data);
    }
    
    const transformedData = data.map(employee => ({
      id: employee.id,
      name: employee.name,
      function: employee.function,
      contractPeriod: employee.contract_period,
      contractHours: employee.contract_hours,
      holidayHours: employee.holiday_hours,
      expectedHours: employee.expected_hours || 0,
      leaveHours: employee.leave_hours || 0,
      writtenHours: employee.written_hours || 0,
      actualHours: employee.actual_hours || 0,
      active: employee.active
    }));
    
    // Store in client-side cache
    clientCache[cacheKey] = {
      data: transformedData,
      timestamp: now
    };
    
    // If this is not a preloading request, preload adjacent periods
    if (!isPreloading) {
      // Use setTimeout to not block the main thread
      setTimeout(() => preloadAdjacentPeriods(year, undefined, month), 100);
    }
    
    return transformedData;
  } catch (error) {
    console.error('Error fetching monthly employee stats:', error);
    throw error;
  }
}

export const startAutoSync = async () => {
  try {
    const response = await fetch(`${API_BASE}/auto-sync/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to start auto-sync: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting auto-sync:', error);
    throw error;
  }
};

export const stopAutoSync = async () => {
  try {
    const response = await fetch(`${API_BASE}/auto-sync/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to stop auto-sync: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error stopping auto-sync:', error);
    throw error;
  }
};

export const getAutoSyncStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/auto-sync/status`);

    if (!response.ok) {
      throw new Error(`Failed to get auto-sync status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting auto-sync status:', error);
    throw error;
  }
};

export const runAutoSyncNow = async () => {
  try {
    const now = new Date();
    const startDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    const endDate = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
    
    console.log(`Running auto-sync for period ${startDate} to ${endDate}`);
    
    // Update function titles from Gripp
    await updateFunctionTitles();
    
    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    
    if (!response.ok) {
      throw new Error('Auto-sync failed');
    }
    
    // Clear employee cache after successful sync
    await clearEmployeeCache();
    
    // Clear client-side cache as well
    clearClientCache();
    
    // Update last sync time
    await fetch(`${API_BASE}/auto-sync/update-last-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lastSync: new Date().toISOString() }),
    });
    
    return true;
  } catch (error) {
    console.error('Error running auto-sync:', error);
    return false;
  }
};

/**
 * Sync employee data from Gripp API
 */
export async function syncEmployeeData(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync employee data');
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error syncing employee data:', error);
    return false;
  }
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auto-sync/update-last-sync`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Error updating last sync timestamp:', error);
  }
}

/**
 * Clear employee data cache
 */
export async function clearEmployeeCache(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/cache/clear/employees`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear employee cache');
    }
    
    // Clear client-side cache as well
    Object.keys(clientCache).forEach(key => {
      delete clientCache[key];
    });
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error clearing employee cache:', error);
    return false;
  }
}

/**
 * Clear client-side cache
 */
export function clearClientCache(): void {
  Object.keys(clientCache).forEach(key => {
    delete clientCache[key];
  });
  console.log('Client-side cache cleared');
}

/**
 * Get cache status
 */
export async function getCacheStatus() {
  try {
    const response = await fetch(`${API_BASE}/cache/status`);
    
    if (!response.ok) {
      throw new Error('Failed to get cache status');
    }
    
    const serverCacheStatus = await response.json();
    
    // Add client-side cache info
    const clientCacheKeys = Object.keys(clientCache);
    const clientCacheInfo = {
      clientCache: {
        total: clientCacheKeys.length,
        keys: clientCacheKeys,
        weekViews: clientCacheKeys.filter(key => key.startsWith('employees_week_')).length,
        monthViews: clientCacheKeys.filter(key => key.startsWith('employees_month_')).length
      }
    };
    
    return {
      ...serverCacheStatus,
      ...clientCacheInfo
    };
  } catch (error) {
    console.error('Error getting cache status:', error);
    return null;
  }
}

/**
 * Update function titles from Gripp API
 */
export async function updateFunctionTitles(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/update-function-titles`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to update function titles');
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error updating function titles:', error);
    return false;
  }
} 