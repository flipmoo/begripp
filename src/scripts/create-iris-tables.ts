/**
 * Create IRIS Tables Script
 *
 * Dit script maakt de benodigde tabellen voor de IRIS Revenue App.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../db/database';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createIrisTables() {
  try {
    console.log('Creating IRIS tables...');

    // Get database connection
    const db = await getDatabase();

    // Read SQL file
    const sqlFilePath = path.join(__dirname, '../db/migrations/iris.sql');
    console.log('SQL file path:', sqlFilePath);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await db.exec(statement + ';');
      console.log('Executed SQL statement:', statement.substring(0, 50) + '...');
    }

    console.log('IRIS tables created successfully!');

    // Verify tables were created
    const tables = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'iris_%'
    `);

    console.log('Created IRIS tables:');
    tables.forEach((table: { name: string }) => {
      console.log(`- ${table.name}`);
    });

  } catch (error) {
    console.error('Error creating IRIS tables:', error);
    process.exit(1);
  }
}

// Run the function
createIrisTables();
