/**
 * Initialize database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'database.sqlite');

// Schema path
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  console.log('Database connection opened successfully');

  // Read schema
  fs.readFile(SCHEMA_PATH, 'utf8', (err, schema) => {
    if (err) {
      console.error('Error reading schema:', err);
      process.exit(1);
    }

    console.log('Schema read successfully');

    // Execute schema
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error executing schema:', err);
        process.exit(1);
      }

      console.log('Schema executed successfully');

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
  });
});
