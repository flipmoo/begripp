/**
 * Database Initialization Script
 * 
 * This script initializes the unified database structure.
 * It can be used to reset and seed the database with initial data.
 */

import { initializeAndSeedDatabase } from './database';

/**
 * Main function to initialize the database
 */
async function main() {
  console.log('Initializing unified database...');
  
  try {
    await initializeAndSeedDatabase();
    console.log('Database initialized and seeded successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run the main function
main();
