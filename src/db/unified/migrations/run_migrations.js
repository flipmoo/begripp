/**
 * Run database migrations
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'database.sqlite');

/**
 * Run migrations
 */
async function runMigrations() {
  return new Promise((resolve, reject) => {
    // Open database connection
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('Database connection opened successfully');

      // Create migrations table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating migrations table:', err);
          reject(err);
          return;
        }

        // Get applied migrations
        db.all('SELECT name FROM migrations', [], (err, rows) => {
          if (err) {
            console.error('Error getting applied migrations:', err);
            reject(err);
            return;
          }

          const appliedMigrationNames = rows.map(row => row.name);

          // Get migration files
          const migrationsDir = path.join(__dirname);
          const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

          // Run migrations
          db.serialize(() => {
            for (const file of migrationFiles) {
              if (appliedMigrationNames.includes(file)) {
                console.log(`Migration ${file} already applied, skipping...`);
                continue;
              }

              console.log(`Running migration ${file}...`);

              // Read migration file
              const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

              // Run migration
              db.run('BEGIN TRANSACTION');

              db.run(migration, (err) => {
                if (err) {
                  console.error(`Error applying migration ${file}:`, err);
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                // Record migration
                db.run('INSERT INTO migrations (name) VALUES (?)', [file], (err) => {
                  if (err) {
                    console.error(`Error recording migration ${file}:`, err);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }

                  db.run('COMMIT');
                  console.log(`Migration ${file} applied successfully`);
                });
              });
            }

            // Close database connection
            db.close((err) => {
              if (err) {
                console.error('Error closing database:', err);
                reject(err);
                return;
              }

              console.log('Database connection closed successfully');
              resolve();
            });
          });
        });
      });
    });
  });
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
