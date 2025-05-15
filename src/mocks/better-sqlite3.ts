/**
 * Mock implementation of better-sqlite3 for browser environments
 * 
 * This file provides a mock implementation of the better-sqlite3 module
 * to prevent errors when importing better-sqlite3 in browser code.
 */

// Create a mock Statement class
class Statement {
  constructor() {
    console.warn('Better-SQLite3 is not supported in browser environments. This is a mock implementation.');
  }

  run() {
    return { changes: 0, lastInsertRowid: 0 };
  }

  get() {
    return null;
  }

  all() {
    return [];
  }

  iterate() {
    return [];
  }

  pluck() {
    return this;
  }

  expand() {
    return this;
  }

  raw() {
    return this;
  }

  bind() {
    return this;
  }

  columns() {
    return [];
  }
}

// Create a mock Database class
class Database {
  constructor() {
    console.warn('Better-SQLite3 is not supported in browser environments. This is a mock implementation.');
  }

  prepare() {
    return new Statement();
  }

  transaction() {
    return () => {};
  }

  exec() {
    return this;
  }

  pragma() {
    return [];
  }

  function() {
    return this;
  }

  aggregate() {
    return this;
  }

  table() {
    return this;
  }

  backup() {
    return { then: () => {} };
  }

  close() {
    return true;
  }

  defaultSafeIntegers() {
    return this;
  }

  open() {
    return true;
  }
}

// Export a function that returns a mock Database instance
export default function betterSqlite3() {
  return new Database();
}
