import axios from 'axios';

export interface ProjectRevenue {
  projectId: number;
  projectName: string;
  months: number[];
}

// Use proxy URL instead of direct API URL
const API_BASE = 'http://localhost:3002/api';

// Client-side cache implementation
interface ClientCache {
  [key: string]: {
    data: ProjectRevenue[];
    timestamp: number;
  }
}

// Cache expiration time in milliseconds (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Initialize client-side cache
const clientCache: ClientCache = {};

// Cache keys
const CLIENT_CACHE_KEYS = {
  REVENUE_HOURS: (year: number) => `revenue_hours_${year}`,
};

/**
 * Check if data for a specific year is in the cache and not expired
 */
export function isDataCached(year: number): boolean {
  const now = Date.now();
  const cacheKey = CLIENT_CACHE_KEYS.REVENUE_HOURS(year);
  
  return !!(clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION);
}

/**
 * Preload data for adjacent years to improve user experience when navigating
 */
export async function preloadAdjacentYears(year: number): Promise<void> {
  // Don't preload if we're already loading data or if the document is hidden
  if (document?.hidden) return;
  
  try {
    // Preload previous and next year
    const prevYear = year - 1;
    const nextYear = year + 1;
    
    // Check if we already have these in cache
    if (!isDataCached(prevYear)) {
      console.log(`Preloading revenue data for year=${prevYear}`);
      getRevenueHours(prevYear, false, true);
    }
    
    if (!isDataCached(nextYear)) {
      console.log(`Preloading revenue data for year=${nextYear}`);
      getRevenueHours(nextYear, false, true);
    }
  } catch (error) {
    console.error('Error preloading adjacent years:', error);
    // Don't throw error for preloading
  }
}

/**
 * Get revenue hours data for a specific year
 */
export async function getRevenueHours(
  year: number,
  forceRefresh = true,
  isPreloading = false
): Promise<ProjectRevenue[]> {
  try {
    const cacheKey = CLIENT_CACHE_KEYS.REVENUE_HOURS(year);
    const now = Date.now();
    
    // Check if we have valid cached data
    if (!forceRefresh && clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      console.log(`Using client-side cached data for revenue year=${year}`);
      
      // If this is not a preloading request, preload adjacent years
      if (!isPreloading) {
        // Use setTimeout to not block the main thread
        setTimeout(() => preloadAdjacentYears(year), 100);
      }
      
      return clientCache[cacheKey].data;
    }
    
    // Add a timestamp parameter to prevent caching issues
    const currentTimestamp = now;
    const url = `${API_BASE}/revenue/hours?year=${year}&_=${currentTimestamp}`;
    
    console.log(`Fetching revenue data from API: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status !== 200) {
      throw new Error('Failed to fetch revenue data');
    }
    
    const data: ProjectRevenue[] = response.data;
    
    // Only log detailed info if not preloading
    if (!isPreloading) {
      console.log('Raw revenue API response received');
    }
    
    // Store in client-side cache
    clientCache[cacheKey] = {
      data: data,
      timestamp: now
    };
    
    // If this is not a preloading request, preload adjacent years
    if (!isPreloading) {
      // Use setTimeout to not block the main thread
      setTimeout(() => preloadAdjacentYears(year), 100);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching revenue hours data:', error);
    throw error;
  }
}

/**
 * Clear client-side revenue cache
 */
export function clearRevenueCache(): void {
  for (const key in clientCache) {
    if (key.startsWith('revenue_')) {
      delete clientCache[key];
    }
  }
  console.log('Revenue cache cleared');
} 