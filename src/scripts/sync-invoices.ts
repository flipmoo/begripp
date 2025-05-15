/**
 * Sync Invoices Script
 * 
 * This script synchronizes invoice data from Gripp API to the local database.
 */

import { syncInvoices } from '../services/sync.service';

async function main() {
  try {
    console.log('Starting sync of invoices...');
    
    // Sync invoices
    await syncInvoices();
    
    console.log('Invoices synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();
