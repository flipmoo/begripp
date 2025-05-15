/**
 * Sync Employees Script
 * 
 * This script synchronizes employee data from Gripp API to the local database.
 */

import { syncEmployees } from '../services/sync.service';

async function main() {
  try {
    console.log('Starting sync of employees...');
    
    // Sync employees
    await syncEmployees();
    
    console.log('Employees synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();
