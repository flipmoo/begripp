/**
 * Mock implementation of sqlite for browser environments
 *
 * This file provides a mock implementation of the sqlite module
 * to prevent errors when importing sqlite in browser code.
 */

// Import the mock sqlite3 implementation
import sqlite3 from './sqlite3';

// Create a mock Database class
class Database {
  constructor() {
    console.warn('SQLite is not supported in browser environments. This is a mock implementation.');
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

// Create a mock open function
const open = async () => {
  return new Database();
};

// Create a default export for ESM compatibility
const defaultExport = { Database, open };

// Export both named exports and default export
export { Database, open, sqlite3 };
export default defaultExport;
