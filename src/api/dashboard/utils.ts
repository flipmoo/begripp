/**
 * Dashboard utilities for handling browser cache and refresh operations
 */

// No need to import dbService anymore

/**
 * Forces a refresh of IndexedDB by clearing the database and application cache
 * This helps when synchronization doesn't immediately show up in the UI
 */
export const forceRefreshCache = async (): Promise<void> => {
  console.log('Forcing refresh of browser caches');

  try {
    // Clear IndexedDB
    const dbName = 'bravoure-dashboard';
    const request = indexedDB.deleteDatabase(dbName);

    await new Promise<void>((resolve, reject) => {
      request.onerror = () => {
        console.error('Error deleting IndexedDB database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('Successfully deleted IndexedDB database');
        resolve();
      };
    });

    // Clear localStorage cache markers
    localStorage.removeItem('dashboard_last_refresh');

    console.log('Cache refresh complete');

    // Force a hard reload of the page
    window.location.reload();
  } catch (error) {
    console.error('Error forcing cache refresh:', error);
    throw error;
  }
};

/**
 * Quickly reloads the dashboard without a full page refresh
 * @param callback Optional callback to run after reloading
 */
export const quickReloadDashboard = (callback?: () => void): void => {
  console.log('Quick reloading dashboard data');

  // We can trigger a reload by creating a custom event
  const reloadEvent = new CustomEvent('dashboard:reload', {
    detail: { timestamp: new Date().getTime() }
  });
  window.dispatchEvent(reloadEvent);

  if (callback) {
    setTimeout(callback, 500);
  }
};