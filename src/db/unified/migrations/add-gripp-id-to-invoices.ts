/**
 * Migration to add grippId column to invoices table
 */

import { Database } from 'sqlite';
import { getDatabase } from '../database';

/**
 * Run the migration
 */
export async function runMigration(): Promise<void> {
  console.log('Running migration: add-gripp-id-to-invoices');

  try {
    // Get database connection
    const db = await getDatabase();

    // Check if the migration has already been applied
    const migrationExists = await db.get(
      'SELECT * FROM migrations WHERE name = ?',
      'add-gripp-id-to-invoices'
    );

    if (migrationExists) {
      console.log('Migration already applied');
      return;
    }

    // Add grippId column to invoices table
    await db.exec('ALTER TABLE invoices ADD COLUMN grippId INTEGER');

    // Create index for faster lookups
    await db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_gripp_id ON invoices (grippId)');

    // Record the migration
    await db.run(
      'INSERT INTO migrations (name, applied_at) VALUES (?, datetime("now"))',
      'add-gripp-id-to-invoices'
    );

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error running migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
// Note: In ESM, we can't use require.main === module, so we'll use a different approach
if (import.meta.url.endsWith(process.argv[1])) {
  runMigration()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
