import NodeCache from 'node-cache';

// TTL values in seconds
const DEFAULT_TTL = 86400; // 24 hours
const DASHBOARD_TTL = 300; // 5 minutes - shorter cache for dashboard components to be more responsive

// Instantiate a new cache with a default TTL of 24 hours (in seconds)
const cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: 120 });

// Cache keys
export const CACHE_KEYS = {
  EMPLOYEES_WEEK: (year: number, week: number) => `employees_week_${year}_${week}`,
  EMPLOYEES_MONTH: (year: number, month: number) => `employees_month_${year}_${month}`,
  INVOICES: (filter?: string) => `invoices_${filter || 'all'}`,
  DASHBOARD_STATS: 'dashboard_stats',
  DASHBOARD_PROJECTS: 'dashboard_projects',
  DASHBOARD_EMPLOYEES: 'dashboard_employees',
  DASHBOARD_ACTIVE_PROJECTS: 'dashboard_active_projects',
  // Define which keys are dashboard-related
  isDashboardKey: (key: string) => key === 'dashboard_stats' ||
                                   key === 'dashboard_projects' ||
                                   key === 'dashboard_employees' ||
                                   key === 'dashboard_active_projects' ||
                                   key.startsWith('employees_week_') && key.includes('dashboard=true') ||
                                   key.startsWith('employees_month_') && key.includes('dashboard=true'),
};

// Cache service
export const cacheService = {
  /**
   * Get data from cache
   * @param key Cache key
   * @returns Cached data or undefined if not found
   */
  get: <T>(key: string): T | undefined => {
    const value = cache.get<T>(key);
    console.log(`Cache ${value ? 'HIT' : 'MISS'} for key: ${key}`);
    return value;
  },

  /**
   * Set data in cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in seconds (optional, defaults to stdTTL)
   */
  set: <T>(key: string, data: T, ttl?: number | string): void => {
    // Use shorter TTL for dashboard-related keys to make them more responsive to changes
    const effectiveTtl = ttl ?? (CACHE_KEYS.isDashboardKey(key) ? DASHBOARD_TTL : DEFAULT_TTL);
    cache.set(key, data, effectiveTtl as number);
    console.log(`Cache SET for key: ${key} with TTL: ${effectiveTtl}s`);
  },

  /**
   * Check if key exists in cache
   * @param key Cache key
   * @returns True if key exists in cache
   */
  has: (key: string): boolean => {
    return cache.has(key);
  },

  /**
   * Delete a key from cache
   * @param key Cache key
   * @returns True if key was deleted
   */
  delete: (key: string): boolean => {
    return cache.del(key) > 0;
  },

  /**
   * Clear all cache
   */
  clear: (): void => {
    cache.flushAll();
  },

  /**
   * Clear all employee data from cache
   */
  clearEmployeeData: (): void => {
    const keys = cache.keys();
    const employeeKeys = keys.filter(key =>
      key.startsWith('employees_week_') ||
      key.startsWith('employees_month_') ||
      key === CACHE_KEYS.DASHBOARD_EMPLOYEES
    );

    if (employeeKeys.length > 0) {
      cache.del(employeeKeys);
      console.log(`Cleared ${employeeKeys.length} employee cache entries`);
    }
  },

  /**
   * Clear all invoice data from cache
   */
  clearInvoiceData: (): void => {
    const keys = cache.keys();
    const invoiceKeys = keys.filter(key =>
      key.startsWith('invoices_')
    );

    if (invoiceKeys.length > 0) {
      cache.del(invoiceKeys);
      console.log(`Cleared ${invoiceKeys.length} invoice cache entries`);
    }
  },

  /**
   * Clear all dashboard data from cache
   */
  clearDashboardData: (): void => {
    const keys = cache.keys();
    const dashboardKeys = keys.filter(key =>
      key === CACHE_KEYS.DASHBOARD_STATS ||
      key === CACHE_KEYS.DASHBOARD_PROJECTS ||
      key === CACHE_KEYS.DASHBOARD_EMPLOYEES ||
      key === CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS ||
      (key.startsWith('employees_week_') && key.includes('dashboard=true')) ||
      (key.startsWith('employees_month_') && key.includes('dashboard=true'))
    );

    if (dashboardKeys.length > 0) {
      cache.del(dashboardKeys);
      console.log(`Cleared ${dashboardKeys.length} dashboard cache entries`);
    }
  },

  /**
   * Clear all project data from cache
   */
  clearProjectData: (): void => {
    const keys = cache.keys();
    const projectKeys = keys.filter(key =>
      key === CACHE_KEYS.DASHBOARD_PROJECTS ||
      key === CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS ||
      key.includes('project') ||
      key.includes('Project') ||
      key.startsWith('dashboard_projects_')
    );

    if (projectKeys.length > 0) {
      console.log(`Found ${projectKeys.length} project cache entries to clear:`, projectKeys);
      cache.del(projectKeys);
      console.log(`Cleared ${projectKeys.length} project cache entries`);

      // Double check if all keys were cleared
      const remainingKeys = cache.keys().filter(key =>
        key === CACHE_KEYS.DASHBOARD_PROJECTS ||
        key === CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS ||
        key.includes('project') ||
        key.includes('Project') ||
        key.startsWith('dashboard_projects_')
      );

      if (remainingKeys.length > 0) {
        console.warn(`Some project keys remain after clearing: ${remainingKeys.length}`, remainingKeys);
        // Force delete any remaining keys one by one
        remainingKeys.forEach(key => {
          console.log(`Forcing delete of key: ${key}`);
          cache.del(key);
        });
      }
    } else {
      console.log('No project cache entries found to clear');
    }

    // Also clear specific cache keys that might be related
    if (CACHE_KEYS.DASHBOARD_PROJECTS) {
      console.log(`Explicitly clearing DASHBOARD_PROJECTS key: ${CACHE_KEYS.DASHBOARD_PROJECTS}`);
      cache.del(CACHE_KEYS.DASHBOARD_PROJECTS);
    }

    if (CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS) {
      console.log(`Explicitly clearing DASHBOARD_ACTIVE_PROJECTS key: ${CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS}`);
      cache.del(CACHE_KEYS.DASHBOARD_ACTIVE_PROJECTS);
    }
  },

  /**
   * Get all keys in cache
   * @returns Array of keys
   */
  keys: (): string[] => {
    return cache.keys();
  },

  /**
   * Clear all caches
   */
  clearAll: (): void => {
    console.log('Clearing all caches');
    cache.flushAll();
  },
};