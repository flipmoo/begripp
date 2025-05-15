/**
 * Run all migrations
 */

import { runMigration as addGrippIdToInvoices } from './migrations/add-gripp-id-to-invoices';

/**
 * Run all migrations
 */
async function runMigrations(): Promise<void> {
  console.log('Running migrations...');

  try {
    // Run migrations in order
    await addGrippIdToInvoices();

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
// Note: In ESM, we can't use require.main === module, so we'll use a different approach
if (import.meta.url.endsWith(process.argv[1])) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migrations failed:', error);
      process.exit(1);
    });
}
