/**
 * Sync Hours Script
 *
 * This script synchronizes hours data from Gripp API to the local database.
 * It ensures all hours are properly synchronized without any filtering.
 */

import { syncHours } from '../services/sync.service';
import { config } from 'dotenv';
import { getDatabase } from '../db/database';
import { existsSync, accessSync, readFileSync, constants } from 'fs';

// Helper function to print fancy headers
const printHeader = (title: string) => {
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat((80 - title.length) / 2) + title);
  console.log('='.repeat(80) + '\n');
};

// Load environment variables
config();
console.log('Dotenv loaded successfully');

// Configure API client
console.log(`Using Gripp API server: ${process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php'}`);
console.log(`Using Gripp API key: ${process.env.GRIPP_API_KEY ? '********' + process.env.GRIPP_API_KEY.slice(-4) : 'Not set'}`);

async function main() {
  try {
    printHeader('STARTING HOURS SYNCHRONIZATION');

    // Parse command line arguments
    const args = process.argv.slice(2);
    let startDate: string;
    let endDate: string;

    if (args.length >= 2) {
      // Use provided date range
      startDate = args[0];
      endDate = args[1];
      console.log(`Using provided date range: ${startDate} to ${endDate}`);
    } else {
      // Get default date range for sync
      const now = new Date();
      startDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]; // Start of previous year
      endDate = new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]; // End of next year
      console.log(`Using default date range: ${startDate} to ${endDate}`);
    }

    // Check if we want to sync a specific month
    if (args.length === 1) {
      const monthArg = args[0];

      // Check if it's in format YYYY-MM
      if (/^\d{4}-\d{2}$/.test(monthArg)) {
        const [year, month] = monthArg.split('-').map(Number);

        // Create date for first day of month
        const firstDay = new Date(year, month - 1, 1);

        // Create date for last day of month
        const lastDay = new Date(year, month, 0);

        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];

        console.log(`Syncing specific month: ${monthArg}`);
        console.log(`Date range: ${startDate} to ${endDate}`);
      } else {
        console.log(`Invalid month format: ${monthArg}. Expected format: YYYY-MM`);
        console.log(`Using default date range: ${startDate} to ${endDate}`);
      }
    }

    printHeader('CHECKING DATABASE');

    // Check database connection
    const dbPath = process.env.DATABASE_PATH || 'src/db/database.sqlite';
    console.log(`Database path: ${dbPath}`);

    // Check if database file exists
    if (existsSync(dbPath)) {
      console.log('✅ Database file exists, checking permissions...');

      try {
        // Check if we can read and write to the database file
        accessSync(dbPath, constants.R_OK | constants.W_OK);
        console.log('✅ Database file is readable and writable');
      } catch (err) {
        console.error('❌ Database file permission error:', err);
        process.exit(1);
      }
    } else {
      console.error('❌ Database file does not exist:', dbPath);
      process.exit(1);
    }

    // Open database connection
    console.log(`Opening database connection to ${dbPath}...`);
    const db = await getDatabase();
    console.log('✅ Database connection opened successfully');

    // Check if schema exists
    const schemaPath = process.env.SCHEMA_PATH || 'src/db/schema.sql';
    console.log(`Looking for schema at ${schemaPath}`);

    if (existsSync(schemaPath)) {
      console.log('✅ Schema file found, loading...');

      try {
        // Apply schema
        const schema = readFileSync(schemaPath, 'utf8');
        await db.exec(schema);
        console.log('✅ Schema applied successfully');
      } catch (err) {
        console.error('⚠️ Error applying schema:', err);
        // Continue anyway, as the schema might already be applied
      }
    } else {
      console.warn('⚠️ Schema file not found, continuing with existing database structure');
    }

    // Get SQLite version
    const versionResult = await db.get('SELECT sqlite_version() as version');
    console.log(`SQLite version: ${versionResult.version}`);

    // Get current time for measuring duration
    const startTime = Date.now();

    // Sync hours
    printHeader('SYNCING HOURS');
    await syncHours(startDate, endDate);

    // Calculate duration
    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;

    printHeader('SYNC COMPLETED');
    console.log(`Total sync duration: ${minutes} minutes and ${seconds} seconds`);
    console.log('Hours synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();
