/**
 * Sync All Script
 * 
 * This script synchronizes all data from Gripp API to the local database.
 */

import { syncAllData } from '../services/sync.service';

async function main() {
  try {
    console.log('Starting sync of all data...');
    
    // Get date range for sync
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]; // Start of previous year
    const endDate = new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]; // End of next year
    
    console.log(`Date range: ${startDate} to ${endDate}`);
    
    // Sync all data
    await syncAllData(startDate, endDate);
    
    console.log('All data synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();
