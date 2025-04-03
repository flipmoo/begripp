import { format } from 'date-fns';
import { Absence, AbsencesByEmployee } from './absence.service';
import { API_BASE, fetchWithRetry, checkApiHealth } from './api';

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

// Set max retry attempts for API calls (for 503 errors)
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Increase cache expiration time from 2 hours to 24 hours (in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; 

// Client-side cache for employee data
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// Global cache for all employee data
let globalEmployeeCache: CacheItem<EmployeeWithStats[]> | null = null;

// Cache for specific periods
const clientCache: { [key: string]: CacheItem<EmployeeWithStats[]> } = {};

// Cache keys
const CLIENT_CACHE_KEYS = {
  EMPLOYEES_WEEK: (year: number, week: number) => `employees_week_${year}_${week}`,
  EMPLOYEES_MONTH: (year: number, month: number) => `employees_month_${year}_${month}`,
  GLOBAL_EMPLOYEES: 'global_employees',
  DASHBOARD_EMPLOYEES: 'dashboard_employees',
};

/**
 * Check if data for a specific period is in the cache and not expired
 * Accepts either a direct cacheKey string or year/week/month parameters
 */
export function isDataCached(yearOrCacheKey: number | string, week?: number, month?: number): boolean {
  const now = Date.now();
  let cacheKey: string;
  
  if (typeof yearOrCacheKey === 'string') {
    // If a direct cache key is provided, use it
    cacheKey = yearOrCacheKey;
  } else {
    // Otherwise build the cache key from year/week/month
    const year = yearOrCacheKey;
    if (week !== undefined) {
      cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_WEEK(year, week);
    } else if (month !== undefined) {
      // Convert from 0-11 to 1-12 for month cache keys
      const humanMonth = month + 1;
      cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_MONTH(year, humanMonth);
    } else {
      return false;
    }
  }
  
  // Check specific period cache
  if (clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
    console.log(`Cache hit for ${cacheKey}`);
    return true;
  }
  
  // Check global cache as fallback
  const hasGlobalCache = !!(globalEmployeeCache && (now - globalEmployeeCache.timestamp) < CACHE_EXPIRATION);
  console.log(`Cache ${hasGlobalCache ? 'hit' : 'miss'} for global employee cache`);
  return hasGlobalCache;
}

/**
 * Get data from cache with specific key
 */
function getFromCache(cacheKey: string): EmployeeWithStats[] | null {
  const now = Date.now();
  
  // First check the specific cache key
  if (clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
    console.log(`Using cache for ${cacheKey}`);
    return clientCache[cacheKey].data;
  }
  
  // Next check the global cache as a fallback
  if (globalEmployeeCache && (now - globalEmployeeCache.timestamp) < CACHE_EXPIRATION) {
    console.log(`Using global cache as fallback for ${cacheKey}`);
    return globalEmployeeCache.data;
  }
  
  return null;
}

/**
 * Update cache with the given key and data
 */
function updateCache(cacheKey: string, data: EmployeeWithStats[]): void {
  console.log(`Updating cache for ${cacheKey}`);
  
  // Update specific cache
  clientCache[cacheKey] = {
    data: [...data], // Create a copy to avoid reference issues
    timestamp: Date.now()
  };
  
  // Also update global cache
  globalEmployeeCache = {
    data: [...data], // Create a copy to avoid reference issues
    timestamp: Date.now()
  };

  // If this is a dashboard-related view, also cache it separately
  if (cacheKey.includes('_month_') || cacheKey.includes('_week_')) {
    clientCache[CLIENT_CACHE_KEYS.DASHBOARD_EMPLOYEES] = {
      data: [...data],
      timestamp: Date.now()
    };
    console.log(`Also updated dashboard employees cache`);
  }
}

/**
 * Manually clear the client-side cache
 */
export function clearEmployeeCache(): void {
  console.log('Clearing all employee caches');
  Object.keys(clientCache).forEach(key => {
    delete clientCache[key];
  });
  globalEmployeeCache = null;
}

/**
 * Get cache status for diagnostics
 */
export async function getCacheStatus(): Promise<{
  success: boolean;
  stats: {
    total: number;
    employeeWeek: number;
    employeeMonth: number;
    keys: string[];
  };
  clientCache?: {
    total: number;
    keys: string[];
    weekViews: number;
    monthViews: number;
  };
}> {
  try {
    // Client-side cache statistics
    const clientCacheKeys = Object.keys(clientCache);
    const weekKeys = clientCacheKeys.filter(key => key.includes('_week_'));
    const monthKeys = clientCacheKeys.filter(key => key.includes('_month_'));
    
    return {
      success: true,
      stats: {
        total: clientCacheKeys.length,
        employeeWeek: weekKeys.length,
        employeeMonth: monthKeys.length,
        keys: clientCacheKeys,
      },
      clientCache: {
        total: clientCacheKeys.length,
        keys: clientCacheKeys,
        weekViews: weekKeys.length,
        monthViews: monthKeys.length,
      }
    };
  } catch (error) {
    console.error('Error getting cache status:', error);
    return {
      success: false,
      stats: {
        total: 0,
        employeeWeek: 0,
        employeeMonth: 0,
        keys: [],
      }
    };
  }
}

/**
 * Preload adjacent periods to improve user experience when navigating
 */
async function preloadAdjacentPeriods(year: number, week?: number, month?: number): Promise<void> {
  try {
    console.log(`Preloading adjacent periods for ${week !== undefined ? `week ${week}` : `month ${month}`} of ${year}`);
    
    if (week !== undefined) {
      // Preload previous and next week
      const prevWeek = week > 1 ? week - 1 : 52;
      const prevYear = week > 1 ? year : year - 1;
      
      const nextWeek = week < 52 ? week + 1 : 1;
      const nextYear = week < 52 ? year : year + 1;
      
      // Only preload if not already cached
      if (!isDataCached(prevYear, prevWeek)) {
        getEmployeeStats(prevYear, prevWeek, undefined, undefined, false, true);
      }
      
      if (!isDataCached(nextYear, nextWeek)) {
        getEmployeeStats(nextYear, nextWeek, undefined, undefined, false, true);
      }
    } else if (month !== undefined) {
      // Preload previous and next month
      const prevMonth = month > 1 ? month - 1 : 12;
      const prevYear = month > 1 ? year : year - 1;
      
      const nextMonth = month < 12 ? month + 1 : 1;
      const nextYear = month < 12 ? year : year + 1;
      
      // Only preload if not already cached
      if (!isDataCached(prevYear, undefined, prevMonth)) {
        getEmployeeMonthStats(prevYear, prevMonth, undefined, true);
      }
      
      if (!isDataCached(nextYear, undefined, nextMonth)) {
        getEmployeeMonthStats(nextYear, nextMonth, undefined, true);
      }
    }
  } catch (error) {
    console.error('Error preloading adjacent periods:', error);
    // Don't throw error for preloading
  }
}

// Helper function to use fallback data when API fails
function getFallbackData() {
  return [
    {
      id: 0,
      name: "API Server Starting...",
      function: "Please wait",
      contractPeriod: "N/A",
      contractHours: 0,
      holidayHours: 0,
      expectedHours: 0,
      leaveHours: 0,
      writtenHours: 0,
      actualHours: 0,
      active: true
    }
  ];
}

/**
 * Get employee statistics for a specific week
 */
export async function getEmployeeStats(
  year: number, 
  week: number, 
  forceRefresh = false,
  timestamp?: number,
  callback?: (data: EmployeeWithStats[]) => void,
  isPreloading = false,
  isDashboard = false
): Promise<{ data: EmployeeWithStats[], fromCache: boolean }> {
  console.log(`getEmployeeStats called for year=${year}, week=${week}, forceRefresh=${forceRefresh}, timestamp=${timestamp}, isDashboard=${isDashboard}`);
  const cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_WEEK(year, week);
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      if (typeof callback === 'function') callback(cachedData);
      console.log(`Cache HIT for key: ${cacheKey}`);
      console.log(`Using cached data for year=${year}, week=${week} from /api/employee-stats endpoint`);
      
      // Preload adjacent periods in background
      if (!isPreloading) {
        setTimeout(() => preloadAdjacentPeriods(year, week), 1000);
      }
      
      return { data: cachedData, fromCache: true };
    } else {
      console.log(`Cache MISS for key: ${cacheKey}`);
      console.log(`Fetching employees for year=${year}, week=${week} from /api/employee-stats endpoint`);
    }
  } else {
    console.log(`Force refresh requested for key: ${cacheKey}`);
  }
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      // Add dashboard parameter to the URL if this is a dashboard request
      const dashboardParam = isDashboard ? '&dashboard=true' : '';
      
      // Add timestamp for cache busting
      const cacheBuster = timestamp ? `&_t=${timestamp}` : forceRefresh ? `&_t=${Date.now()}` : '';
      
      // Fetch data from API with retry logic and abort signal
      const response = await fetchWithRetry(`${API_BASE}/employee-stats?year=${year}&week=${week}${dashboardParam}${cacheBuster}`, {
        // Add cache-busting headers when forceRefresh is true
        headers: forceRefresh ? { 
          'Cache-Control': 'no-cache, no-store, must-revalidate', 
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Request-Timestamp': String(timestamp || Date.now())
        } : {},
        signal: controller.signal
      });
      
      // Clear timeout since request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching employee stats: ${response.status} - ${errorText}`);
      }
      
      const responseData = await response.json();
      
      // Ensure we have an array of employees
      let employeesFromApi: ApiEmployee[] = [];
      
      if (Array.isArray(responseData)) {
        employeesFromApi = responseData;
      } else if (responseData && typeof responseData === 'object') {
        // Handle case where API returns an object with response field
        if (responseData.response && Array.isArray(responseData.response)) {
          employeesFromApi = responseData.response;
        } else {
          console.warn('Received object instead of array from API. Creating empty employee list.');
          employeesFromApi = [];
        }
      } else {
        console.error('Unexpected response format from API:', responseData);
        throw new Error('Unexpected response format from API');
      }
      
      console.log(`Received ${employeesFromApi.length} employees from API`);
      
      // Convert API data to our format
      const employeesWithStats = employeesFromApi.map(apiEmployee => ({
        id: apiEmployee.id,
        name: apiEmployee.name,
        function: apiEmployee.function,
        contractPeriod: apiEmployee.contract_period,
        contractHours: apiEmployee.contract_hours,
        holidayHours: apiEmployee.holiday_hours,
        expectedHours: apiEmployee.expected_hours || 0,
        leaveHours: apiEmployee.leave_hours || 0,
        writtenHours: apiEmployee.written_hours || 0,
        actualHours: apiEmployee.actual_hours || 0,
        active: apiEmployee.active || false
      }));
      
      // Update cache
      console.log(`Cache SET for key: ${cacheKey}`);
      updateCache(cacheKey, employeesWithStats);
      
      if (typeof callback === 'function') callback(employeesWithStats);
      
      // Preload adjacent periods in background
      if (!isPreloading) {
        setTimeout(() => preloadAdjacentPeriods(year, week), 1000);
      }
      
      return { data: employeesWithStats, fromCache: false };
    } catch (error) {
      // Clear timeout to prevent memory leaks
      clearTimeout(timeoutId);
      
      // Handle AbortError specially
      if (error.name === 'AbortError') {
        console.warn(`Request for employee stats for ${year}-${week} timed out after 8 seconds`);
        throw new Error(`Request timed out after 8 seconds`);
      }
      
      // Re-throw other errors
      throw error;
    }
  } catch (error) {
    console.error(`Error fetching employee stats for ${year}-${week}:`, error);
    
    // Enhanced error handling with specific messages for different error types
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Specific handling for rate limiting errors
    if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
      console.warn(`Rate limit hit when fetching data for ${year}-${week}, will use cached data if available`);
      
      // Add some random delay before trying to use the cached data to prevent thundering herd
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, 500 + jitter));
    }
    
    // If error and we have cached data, use that as fallback
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.warn('Using cached data as fallback after API error');
      if (typeof callback === 'function') callback(cachedData);
      return { data: cachedData, fromCache: true };
    }
    
    // If we have global cache data as a last resort, use that
    if (globalEmployeeCache && globalEmployeeCache.data) {
      console.warn('Using global cache as last resort after API error');
      if (typeof callback === 'function') callback(globalEmployeeCache.data);
      return { data: globalEmployeeCache.data, fromCache: true };
    }
    
    // As a very last resort, return fallback data to prevent UI from getting stuck
    const fallbackData = getFallbackData();
    console.warn('Using fallback data as absolute last resort');
    if (typeof callback === 'function') callback(fallbackData);
    return { data: fallbackData, fromCache: false };
  }
}

export function enrichEmployeesWithAbsences(
    employees: EmployeeWithStats[] | null | undefined, 
    absencesByEmployee: AbsencesByEmployee
): EmployeeWithStats[] {
    // If employees is null, undefined, or not an array, return an empty array
    if (!employees || !Array.isArray(employees)) {
        console.warn('enrichEmployeesWithAbsences: employees is not an array', employees);
        return [];
    }
    
    return employees.map(employee => ({
        ...employee,
        absences: absencesByEmployee[employee.id] || []
    }));
}

export async function getEmployeeDetails(employeeId: number) {
    try {
        const response = await fetchWithRetry(`${API_BASE}/employees/${employeeId}`);
        if (!response.ok) {
            console.error(`API error (${response.status}): Failed to fetch employee details for ID ${employeeId}`);
            return null;
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
  forceRefresh = false,
  isPreloading = false,
  isDashboard = false
): Promise<{ data: EmployeeWithStats[], fromCache: boolean }> {
  // Convert month from JS month (0-11) to human month (1-12) for our cache keys
  const humanMonth = month + 1;
  const cacheKey = CLIENT_CACHE_KEYS.EMPLOYEES_MONTH(year, humanMonth);
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      console.log(`Using cached data for year=${year}, month=${humanMonth} from /api/employee-month-stats endpoint`);
      
      // Preload adjacent periods in background
      if (!isPreloading) {
        setTimeout(() => preloadAdjacentPeriods(year, undefined, month), 1000);
      }
      
      return { data: cachedData, fromCache: true };
    } else {
      console.log(`Cache MISS for key: ${cacheKey}`);
      console.log(`Fetching employee data for month ${humanMonth} of ${year} from /api/employee-month-stats endpoint`);
    }
  } else {
    console.log(`Force refresh requested for key: ${cacheKey}`);
  }
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      // Add dashboard parameter to the URL if this is a dashboard request
      const dashboardParam = isDashboard ? '&dashboard=true' : '';
      
      // Add timestamp for cache busting if force refresh
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : '';
      
      // Use humanMonth (1-12) for the API call
      const response = await fetchWithRetry(`${API_BASE}/employee-month-stats?year=${year}&month=${humanMonth}${dashboardParam}${timestamp}`, {
        headers: forceRefresh ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {},
        signal: controller.signal
      });
      
      // Clear timeout since request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching employee month stats: ${response.status} - ${errorText}`);
      }
      
      const responseData = await response.json();
      
      // Ensure we have an array of employees
      let employeesList: ApiEmployee[] = [];
      
      if (Array.isArray(responseData)) {
        // Response is already an array, use it directly
        employeesList = responseData;
      } else if (responseData && typeof responseData === 'object') {
        // Response is an object, check if it has a response property that's an array
        if (responseData.response && Array.isArray(responseData.response)) {
          employeesList = responseData.response;
        } else {
          console.warn('Received object instead of array from API. Creating empty employee list.');
          employeesList = [];
        }
      } else {
        console.error('Unexpected response format from API:', responseData);
        throw new Error('Unexpected response format from API');
      }
      
      // Convert API data to our format
      const employeesWithStats = employeesList.map(apiEmployee => ({
        id: apiEmployee.id,
        name: apiEmployee.name,
        function: apiEmployee.function,
        contractPeriod: apiEmployee.contract_period,
        contractHours: apiEmployee.contract_hours,
        holidayHours: apiEmployee.holiday_hours,
        expectedHours: apiEmployee.expected_hours || 0,
        leaveHours: apiEmployee.leave_hours || 0,
        writtenHours: apiEmployee.written_hours || 0,
        actualHours: apiEmployee.actual_hours || 0,
        active: apiEmployee.active || false
      }));
      
      // Update cache
      updateCache(cacheKey, employeesWithStats);
      
      // Preload adjacent periods in background
      if (!isPreloading) {
        setTimeout(() => preloadAdjacentPeriods(year, undefined, month), 1000);
      }
      
      return { data: employeesWithStats, fromCache: false };
    } catch (error: unknown) {
      // Clear timeout to prevent memory leaks
      clearTimeout(timeoutId);
      
      // Handle AbortError specially
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`Request for employee month stats for ${year}-${month} timed out after 8 seconds`);
        throw new Error(`Request timed out after 8 seconds`);
      }
      
      // Re-throw other errors
      throw error;
    }
  } catch (error: unknown) {
    console.error(`Error fetching employee month stats for ${year}-${month}:`, error);
    
    // Enhanced error handling with specific messages for different error types
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Specific handling for rate limiting errors
    if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
      console.warn(`Rate limit hit when fetching data for ${year}-${month}, will use cached data if available`);
      
      // Add some random delay before trying to use the cached data to prevent thundering herd
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, 500 + jitter));
    }
    
    // If error and we have cached data, use that as fallback
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.warn('Using cached data as fallback after API error');
      return { data: cachedData, fromCache: true };
    }
    
    // If we have global cache data as a last resort, use that
    if (globalEmployeeCache && globalEmployeeCache.data) {
      console.warn('Using global cache as last resort after API error');
      return { data: globalEmployeeCache.data, fromCache: true };
    }
    
    // As a very last resort, return fallback data to prevent UI from getting stuck
    const fallbackData = getFallbackData();
    console.warn('Using fallback data as absolute last resort');
    return { data: fallbackData, fromCache: false };
  }
}

export const startAutoSync = async () => {
  try {
    const response = await fetchWithRetry(`${API_BASE}/auto-sync/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to start auto-sync`);
      return { success: false, error: response.statusText };
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting auto-sync:', error);
    return { success: false, error: 'Network error' };
  }
};

export const stopAutoSync = async () => {
  try {
    const response = await fetchWithRetry(`${API_BASE}/auto-sync/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to stop auto-sync`);
      return { success: false, error: response.statusText };
    }

    return await response.json();
  } catch (error) {
    console.error('Error stopping auto-sync:', error);
    return { success: false, error: 'Network error' };
  }
};

export const getAutoSyncStatus = async () => {
  try {
    const response = await fetchWithRetry(`${API_BASE}/auto-sync/status`);

    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to get auto-sync status`);
      return { running: false, error: response.statusText };
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting auto-sync status:', error);
    return { running: false, error: 'Network error' };
  }
};

export const runAutoSyncNow = async () => {
  try {
    const response = await fetchWithRetry(`${API_BASE}/auto-sync/run-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to run auto-sync now`);
      return { success: false, error: response.statusText };
    }

    return await response.json();
  } catch (error) {
    console.error('Error running auto-sync now:', error);
    return { success: false, error: 'Network error' };
  }
};

/**
 * Sync employee data from Gripp API
 */
export async function syncEmployeeData(): Promise<boolean> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/sync`, {
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
    const response = await fetchWithRetry(`${API_BASE}/auto-sync/update-last-sync`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to update last sync timestamp');
    }
  } catch (error) {
    console.error('Error updating last sync timestamp:', error);
  }
}

/**
 * Update function titles from Gripp API
 */
export async function updateFunctionTitles(): Promise<boolean> {
  try {
    // Check API health before making request
    const isHealthy = await checkApiHealth();
    if (!isHealthy) {
      console.log('API server not ready, skipping function titles update');
      return false;
    }

    const response = await fetchWithRetry(`${API_BASE}/update-function-titles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, 3); // Use 3 retries
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update function titles: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to update function titles: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error updating function titles:', error);
    return false;
  }
} 