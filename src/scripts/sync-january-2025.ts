/**
 * Sync January 2025 Hours Script
 *
 * This script synchronizes hours data for January 2025 from Gripp API to the local database.
 * It ensures all hours are properly synchronized without any filtering.
 */

import { syncHours } from '../services/sync.service';
import { config } from 'dotenv';
import { getDatabase } from '../db/database';
import { existsSync, accessSync, readFileSync, constants } from 'fs';

// Load environment variables
config();
console.log('Dotenv loaded successfully');

// Configure API client
console.log(`Using Gripp API server: ${process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php'}`);
console.log(`Using Gripp API key: ${process.env.GRIPP_API_KEY}`);

async function main() {
  try {
    console.log('Starting sync of hours for January 2025...');

    // Set date range for January 2025
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';

    console.log(`Date range: ${startDate} to ${endDate}`);

    // Check database connection
    const dbPath = process.env.DATABASE_PATH || 'src/db/database.sqlite';
    console.log(`Database path: ${dbPath}`);

    // Check if database file exists
    if (existsSync(dbPath)) {
      console.log('Database file exists, checking permissions...');

      try {
        // Check if we can read and write to the database file
        accessSync(dbPath, constants.R_OK | constants.W_OK);
        console.log('Database file is readable and writable');
      } catch (err) {
        console.error('Database file permission error:', err);
        process.exit(1);
      }
    } else {
      console.error('Database file does not exist:', dbPath);
      process.exit(1);
    }

    // Open database connection
    console.log(`Opening database connection to ${dbPath}...`);
    const db = await getDatabase();
    console.log('Database connection opened successfully');

    // Check if schema exists
    const schemaPath = process.env.SCHEMA_PATH || 'src/db/schema.sql';
    console.log(`Looking for schema at ${schemaPath}`);

    if (existsSync(schemaPath)) {
      console.log('Schema file found, loading...');

      try {
        // Apply schema
        const schema = readFileSync(schemaPath, 'utf8');
        await db.exec(schema);
        console.log('Schema applied successfully');
      } catch (err) {
        console.error('Error applying schema:', err);
        // Continue anyway, as the schema might already be applied
      }
    } else {
      console.warn('Schema file not found, continuing with existing database structure');
    }

    // Get SQLite version
    const versionResult = await db.get('SELECT sqlite_version() as version');
    console.log(`SQLite version: ${versionResult.version}`);

    // Get current hours count for Internal hours 2025 in January
    const beforeCount = await db.get(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM hours
      WHERE project_name LIKE '%Internal hours 2025%'
      AND date BETWEEN ? AND ?
    `, [startDate, endDate]);

    console.log(`Before sync: Internal hours 2025 for January 2025 - Count: ${beforeCount.count}, Total: ${beforeCount.total}`);

    // Sync hours for January 2025
    await syncHours(startDate, endDate);

    // Get updated hours count for Internal hours 2025 in January
    const afterCount = await db.get(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM hours
      WHERE project_name LIKE '%Internal hours 2025%'
      AND date BETWEEN ? AND ?
    `, [startDate, endDate]);

    console.log(`After sync: Internal hours 2025 for January 2025 - Count: ${afterCount.count}, Total: ${afterCount.total}`);

    // Calculate difference
    const countDiff = afterCount.count - beforeCount.count;
    const totalDiff = afterCount.total - beforeCount.total;

    console.log(`Difference: Count: ${countDiff > 0 ? '+' : ''}${countDiff}, Total: ${totalDiff > 0 ? '+' : ''}${totalDiff}`);

    console.log('Hours for January 2025 synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();
