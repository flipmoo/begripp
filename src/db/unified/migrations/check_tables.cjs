/**
 * Check tables in the database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'database.sqlite');

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  console.log('Database connection opened successfully');

  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error getting tables:', err);
      process.exit(1);
    }

    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });

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
