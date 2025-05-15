/**
 * Mock implementation of sqlite/build/Database.js for browser environments
 * 
 * This file provides a mock implementation of the Database.js module
 * to prevent errors when importing it in browser code.
 */

// Create a mock Database class
class Database {
  constructor() {
    console.warn('SQLite Database is not supported in browser environments. This is a mock implementation.');
  }

  run() {
    return Promise.resolve(this);
  }

  get() {
    return Promise.resolve(null);
  }

  all() {
    return Promise.resolve([]);
  }

  prepare() {
    return this;
  }

  exec() {
    return Promise.resolve(this);
  }

  close() {
    return Promise.resolve();
  }
}

// Export the Database class
export { Database };
export default Database;
