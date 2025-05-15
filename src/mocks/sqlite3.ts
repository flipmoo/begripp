/**
 * Mock implementation of sqlite3 for browser environments
 * 
 * This file provides a mock implementation of the sqlite3 module
 * to prevent errors when importing sqlite3 in browser code.
 */

// Create a mock Database class
class Database {
  constructor() {
    console.warn('SQLite3 is not supported in browser environments. This is a mock implementation.');
  }

  run() {
    return this;
  }

  get() {
    return null;
  }

  all() {
    return [];
  }

  prepare() {
    return this;
  }

  exec() {
    return this;
  }

  close() {
    return this;
  }
}

// Create a mock sqlite3 module
const sqlite3 = {
  Database,
  verbose: () => sqlite3
};

export default sqlite3;
