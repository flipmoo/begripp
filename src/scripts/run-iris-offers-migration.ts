/**
 * Run IRIS Offers Migration
 * 
 * Dit script voert de migratie uit om de iris_offers tabel aan te maken.
 */

import { getDatabase } from '../db/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('Running IRIS offers migration...');
    
    // Get database connection
    const db = await getDatabase();
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../db/migrations/iris_offers.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split migration into statements
    const statements = migrationSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      await db.exec(statement + ';');
      console.log('Executed statement:', statement);
    }
    
    console.log('IRIS offers migration completed successfully!');
  } catch (error) {
    console.error('Error running IRIS offers migration:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
