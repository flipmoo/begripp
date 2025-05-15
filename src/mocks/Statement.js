/**
 * Mock implementation of sqlite/build/Statement.js for browser environments
 * 
 * This file provides a mock implementation of the Statement.js module
 * to prevent errors when importing it in browser code.
 */

// Create a mock Statement class
class Statement {
  constructor() {
    console.warn('SQLite Statement is not supported in browser environments. This is a mock implementation.');
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

  bind() {
    return Promise.resolve(this);
  }

  finalize() {
    return Promise.resolve();
  }
}

// Export the Statement class
export { Statement };
export default Statement;
