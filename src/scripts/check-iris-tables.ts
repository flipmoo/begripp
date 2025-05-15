/**
 * Check IRIS Tables Script
 * 
 * Dit script controleert de IRIS tabellen in de database en repareert ze indien nodig.
 */

import { getDatabase } from '../db/database';

async function checkIrisTables() {
  try {
    console.log('Checking IRIS tables...');

    // Get database connection
    const db = await getDatabase();

    // Check if iris_manual_monthly_targets table exists
    const tableExists = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='iris_manual_monthly_targets'
    `);

    if (!tableExists) {
      console.log('Table iris_manual_monthly_targets does not exist, creating it...');
      
      // Create the table
      await db.run(`
        CREATE TABLE IF NOT EXISTS iris_manual_monthly_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          target_amount REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(year, month)
        )
      `);
      
      console.log('Table iris_manual_monthly_targets created successfully');
    } else {
      console.log('Table iris_manual_monthly_targets exists');
      
      // Check the structure of the table
      const columns = await db.all(`PRAGMA table_info(iris_manual_monthly_targets)`);
      console.log('Table structure:', columns);
      
      // Check if there are any records in the table
      const count = await db.get(`SELECT COUNT(*) as count FROM iris_manual_monthly_targets`);
      console.log(`Table contains ${count.count} records`);
      
      // Check if there are any records for the current year
      const currentYear = new Date().getFullYear();
      const yearCount = await db.get(`
        SELECT COUNT(*) as count FROM iris_manual_monthly_targets WHERE year = ?
      `, [currentYear]);
      console.log(`Table contains ${yearCount.count} records for year ${currentYear}`);
      
      // Show some sample records
      const samples = await db.all(`
        SELECT * FROM iris_manual_monthly_targets LIMIT 5
      `);
      console.log('Sample records:', samples);
    }

    // Check if we can insert a test record
    console.log('Testing database write operations...');
    
    const testYear = 9999;
    const testMonth = 1;
    const testAmount = 123456.78;
    
    // First delete any existing test record
    await db.run(`
      DELETE FROM iris_manual_monthly_targets 
      WHERE year = ? AND month = ?
    `, [testYear, testMonth]);
    
    // Insert a test record
    await db.run(`
      INSERT INTO iris_manual_monthly_targets (year, month, target_amount, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `, [testYear, testMonth, testAmount]);
    
    // Verify the test record was inserted
    const testRecord = await db.get(`
      SELECT * FROM iris_manual_monthly_targets 
      WHERE year = ? AND month = ?
    `, [testYear, testMonth]);
    
    if (testRecord && testRecord.target_amount === testAmount) {
      console.log('Test record inserted and retrieved successfully');
    } else {
      console.error('Failed to insert or retrieve test record');
      console.log('Retrieved record:', testRecord);
    }
    
    // Clean up the test record
    await db.run(`
      DELETE FROM iris_manual_monthly_targets 
      WHERE year = ? AND month = ?
    `, [testYear, testMonth]);
    
    console.log('Test record cleaned up');
    console.log('IRIS tables check completed successfully');
  } catch (error) {
    console.error('Error checking IRIS tables:', error);
  }
}

// Run the function
checkIrisTables().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
