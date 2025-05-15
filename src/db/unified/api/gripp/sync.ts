/**
 * Gripp Sync Script
 * 
 * This script synchronizes data from Gripp API to the local database.
 */

import { getDatabase } from '../../../database';
import { syncAllData, syncEmployees, syncProjects, syncHours, syncInvoices } from '../../../../services/sync.service';
import { updateSyncStatus } from '../../../../services/sync-service';

// Parse command line arguments
const args = process.argv.slice(2);
const syncProjects = args.includes('--projects');
const syncEmployees = args.includes('--employees');
const syncHours = args.includes('--hours');
const syncInvoices = args.includes('--invoices');
const syncFull = args.includes('--full');

// If no specific sync is requested, sync all
const syncAll = !syncProjects && !syncEmployees && !syncHours && !syncInvoices && !syncFull;

// Get date range for sync
const now = new Date();
const startDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]; // Start of previous year
const endDate = new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]; // End of next year

async function main() {
  try {
    console.log('Starting Gripp sync...');
    console.log(`Date range: ${startDate} to ${endDate}`);
    
    // Initialize database
    const db = await getDatabase();
    console.log('Database connected successfully');
    
    // Sync all data if no specific sync is requested
    if (syncAll || syncFull) {
      console.log('Syncing all data...');
      await syncAllData(startDate, endDate);
      console.log('All data synced successfully');
    } else {
      // Sync specific data types
      if (syncProjects) {
        console.log('Syncing projects...');
        await syncProjects(startDate, endDate);
        console.log('Projects synced successfully');
      }
      
      if (syncEmployees) {
        console.log('Syncing employees...');
        await syncEmployees();
        console.log('Employees synced successfully');
      }
      
      if (syncHours) {
        console.log('Syncing hours...');
        await syncHours(startDate, endDate);
        console.log('Hours synced successfully');
      }
      
      if (syncInvoices) {
        console.log('Syncing invoices...');
        await syncInvoices();
        console.log('Invoices synced successfully');
      }
    }
    
    console.log('Sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during sync:', error);
    
    // Update sync status to error
    try {
      await updateSyncStatus('all', 'error', error instanceof Error ? error.message : 'Unknown error');
    } catch (statusError) {
      console.error('Error updating sync status:', statusError);
    }
    
    process.exit(1);
  }
}

// Run the main function
main();
