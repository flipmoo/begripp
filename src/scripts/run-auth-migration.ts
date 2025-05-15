/**
 * Run Authentication Migration Script
 *
 * Dit script voert de migratie uit om de authenticatie tabellen toe te voegen aan de database.
 * Het maakt eerst een backup van de database en voert dan de migratie uit.
 */
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { backupDatabase } from './backup-database';

// Configuratie
// Gebruik een testdatabase als TEST_MODE=true is ingesteld
const TEST_MODE = process.env.TEST_MODE === 'true';
const DB_PATH = TEST_MODE ? './database_test.sqlite' : './src/db/database.sqlite';
const MIGRATION_PATH = './src/db/unified/migrations/add_authentication_tables.sql'; // Pad naar het migratie script

/**
 * Voer de authenticatie migratie uit
 */
async function runAuthMigration(): Promise<void> {
  console.log('Starting authentication migration...');

  // Controleer of de database bestaat
  if (!existsSync(DB_PATH)) {
    throw new Error(`Database file not found at ${DB_PATH}`);
  }

  // Controleer of het migratie script bestaat
  if (!existsSync(MIGRATION_PATH)) {
    throw new Error(`Migration script not found at ${MIGRATION_PATH}`);
  }

  // Maak eerst een backup van de database
  console.log('Creating database backup...');
  const backupPath = backupDatabase('pre-auth-migration');
  console.log(`Database backup created at: ${backupPath}`);

  // Open de database connectie
  console.log('Opening database connection...');
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  try {
    // Begin een transactie
    console.log('Starting transaction...');
    await db.run('BEGIN TRANSACTION');

    // Lees het migratie script
    console.log('Reading migration script...');
    const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

    // Split het script op in individuele statements
    const statements = migrationSql.split(';').filter(stmt => stmt.trim());

    // Voer elke statement uit
    console.log('Executing migration statements...');
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}`);
        await db.exec(statement + ';');
      } catch (error) {
        // Als het een ALTER TABLE statement is dat faalt omdat de kolom al bestaat, negeer de error
        if (error.message && error.message.includes('duplicate column name')) {
          console.warn('Ignoring duplicate column error:', error.message);
        } else {
          console.error('Error executing statement:', statement);
          console.error('Error details:', error);
          throw error;
        }
      }
    }

    // Commit de transactie
    console.log('Committing transaction...');
    await db.run('COMMIT');

    console.log('Authentication migration completed successfully!');
  } catch (error) {
    // Rollback bij een error
    console.error('Error during migration:', error);
    await db.run('ROLLBACK');
    throw error;
  } finally {
    // Sluit de database connectie
    await db.close();
  }
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  runAuthMigration()
    .then(() => {
      console.log('Migration script completed successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

// Exporteer de functie voor gebruik in andere scripts
export { runAuthMigration };
