import { initializeDatabase, closeDatabase } from './database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  console.log('=== DATABASE INITIALIZATION SCRIPT ===');
  console.log('Checking database status...');
  
  try {
    // Check if the database file exists
    const dbPath = path.join(__dirname, 'database.sqlite');
    const exists = fs.existsSync(dbPath);
    
    if (exists) {
      const stats = fs.statSync(dbPath);
      console.log(`Database file exists at ${dbPath} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      if (stats.size === 0) {
        console.log('Warning: Database file exists but is empty');
      }
    } else {
      console.log(`Database file does not exist at ${dbPath}. Will be created.`);
    }
    
    // Initialize database connection
    console.log('Initializing database connection...');
    const db = await initializeDatabase();
    
    if (!db) {
      throw new Error('Failed to initialize database');
    }
    
    // Verify connection by performing a simple query
    console.log('Verifying database connection...');
    const result = await db.get('SELECT 1 as test');
    
    if (result && result.test === 1) {
      console.log('Database connection verified successfully');
    } else {
      throw new Error('Database verification failed');
    }
    
    // Check if tables exist
    console.log('Checking database structure...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    console.log(`Found ${tables.length} tables in database:`);
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name}`);
    });
    
    // Check if employees table has data
    const employeeCount = await db.get('SELECT COUNT(*) as count FROM employees');
    console.log(`Employees table contains ${employeeCount ? employeeCount.count : 0} records`);
    
    // Run basic maintenance
    console.log('Running database maintenance...');
    await db.exec('VACUUM');
    
    console.log('Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('DATABASE INITIALIZATION ERROR:', error);
    return false;
  } finally {
    // Close connection
    await closeDatabase();
  }
}

// Run the initialization
initDb()
  .then(success => {
    if (success) {
      console.log('Database is ready to use');
      process.exit(0);
    } else {
      console.error('Database initialization failed');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during database initialization:', err);
    process.exit(1);
  }); 