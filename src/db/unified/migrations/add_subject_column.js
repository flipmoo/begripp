/**
 * Add subject column to invoices table
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'database.sqlite');

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  console.log('Database connection opened successfully');

  // Add subject column to invoices table
  db.run('ALTER TABLE invoices ADD COLUMN subject TEXT', (err) => {
    if (err) {
      // If the error is because the column already exists, that's fine
      if (err.message.includes('duplicate column name')) {
        console.log('Column subject already exists in invoices table');
      } else {
        console.error('Error adding subject column to invoices table:', err);
        process.exit(1);
      }
    } else {
      console.log('Column subject added to invoices table successfully');
    }

    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }

      console.log('Database connection closed successfully');
      process.exit(0);
    });
  });
});
