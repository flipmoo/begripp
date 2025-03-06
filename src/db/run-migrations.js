import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Open the database
const db = new sqlite3.Database('./src/db/database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Run migrations in order
async function runMigrations() {
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure order
    
    console.log('Found migration files:', migrationFiles);
    
    // Begin transaction
    await runQuery('BEGIN TRANSACTION');
    
    // Run each migration
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Split the migration into individual statements
      const statements = migration.split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      // Run each statement
      for (const statement of statements) {
        await runQuery(statement);
      }
      
      console.log(`Migration ${file} completed successfully.`);
    }
    
    // Commit transaction
    await runQuery('COMMIT');
    
    console.log('All migrations completed successfully.');
  } catch (error) {
    // Rollback transaction on error
    await runQuery('ROLLBACK');
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Close the database
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
}

// Helper function to run a query
function runQuery(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

// Run the migrations
runMigrations(); 