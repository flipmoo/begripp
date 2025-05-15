/**
 * Mock implementation of the Node.js fs module for browser environments
 * 
 * This file provides a mock implementation of the fs module
 * to prevent errors when importing fs in browser code.
 */

// Create a mock implementation of the fs module
const fs = {
  readFileSync: (path: string, options?: any): string => {
    console.warn(`Mock fs.readFileSync called for path: ${path}`);
    // Return empty string or mock data based on the path
    if (path.endsWith('schema.sql')) {
      return `-- Mock schema.sql content
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  firstname TEXT,
  lastname TEXT,
  email TEXT,
  active INTEGER,
  function TEXT
);`;
    }
    return '';
  },
  
  existsSync: (path: string): boolean => {
    console.warn(`Mock fs.existsSync called for path: ${path}`);
    // Always return true to avoid file not found errors
    return true;
  },
  
  writeFileSync: (path: string, data: any, options?: any): void => {
    console.warn(`Mock fs.writeFileSync called for path: ${path}`);
    // Do nothing in the browser
  },
  
  accessSync: (path: string, mode?: number): void => {
    console.warn(`Mock fs.accessSync called for path: ${path}`);
    // Do nothing in the browser
  },
  
  constants: {
    R_OK: 4,
    W_OK: 2,
    F_OK: 0,
    X_OK: 1
  },
  
  // Add other fs methods as needed
  mkdirSync: (path: string, options?: any): void => {
    console.warn(`Mock fs.mkdirSync called for path: ${path}`);
    // Do nothing in the browser
  },
  
  readdirSync: (path: string, options?: any): string[] => {
    console.warn(`Mock fs.readdirSync called for path: ${path}`);
    // Return empty array
    return [];
  },
  
  statSync: (path: string): any => {
    console.warn(`Mock fs.statSync called for path: ${path}`);
    // Return mock stat object
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: 0,
      mtime: new Date()
    };
  }
};

export const readFileSync = fs.readFileSync;
export const existsSync = fs.existsSync;
export const writeFileSync = fs.writeFileSync;
export const accessSync = fs.accessSync;
export const constants = fs.constants;
export const mkdirSync = fs.mkdirSync;
export const readdirSync = fs.readdirSync;
export const statSync = fs.statSync;

export default fs;
