/**
 * Run database migrations
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run migrations
 */
async function runMigrations(): Promise<void> {
  // Get database connection
  const db = await getDatabase();

  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const appliedMigrations = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
  const appliedMigrationNames = appliedMigrations.map(m => m.name);

  // Get migration files
  const migrationsDir = path.join(__dirname);
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  // Run migrations
  for (const file of migrationFiles) {
    if (appliedMigrationNames.includes(file)) {
      console.log(`Migration ${file} already applied, skipping...`);
      continue;
    }

    console.log(`Running migration ${file}...`);

    // Read migration file
    const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    // Run migration
    try {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');

      // Run migration
      db.exec(migration);

      // Record migration
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);

      // Commit transaction
      db.exec('COMMIT');

      console.log(`Migration ${file} applied successfully`);
    } catch (error) {
      // Rollback transaction
      db.exec('ROLLBACK');

      console.error(`Error applying migration ${file}:`, error);
      throw error;
    }
  }

  // Close database connection
  await db.close();
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('Migrations completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running migrations:', error);
    process.exit(1);
  });
